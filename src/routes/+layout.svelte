<script lang="ts">
	import { onMount, setContext } from 'svelte';
	import '../app.css';
	import OnlineCount from '$lib/components/OnlineCount.svelte';
	import { writable, type Writable } from 'svelte/store';
	import { supabase } from '$lib/supabaseClient';
	import favicon from '$lib/assets/favicon.svg';
	import type { Session } from '$lib/session';
	import type { User } from '@supabase/supabase-js';
	import { TRACKED_PLAYERS, type TrackedPlayerKey } from '$lib/trackedPlayers';

	type Person = { label: string; user_id: string };
	type PlayerDisplay = { label: string; user_id: string | null };
	type HistoryRow = { date: string; values: Record<TrackedPlayerKey, number | null> };

	const TOTAL_BLOCKS_PER_DAY = 32;
	const HISTORY_LOOKBACK_DAYS = 30;

	const session: Writable<Session> = writable({ user: null, name: '', loading: true });
	setContext('session', session);

	const applyUser = (u: User | null) => {
		session.set({
			user: u,
			name: u?.user_metadata?.name ?? '',
			loading: false
		});
	};

	let trackedDisplays = $state<Record<TrackedPlayerKey, PlayerDisplay>>({
		andrew: { label: 'Andrew', user_id: null },
		nico: { label: 'Nico', user_id: null }
	});
	let dayHistoryRows = $state<HistoryRow[]>([]);
	let dayHistoryOpen = $state(false);
	let dayHistoryLoading = $state(false);
	let dateMenuEl: HTMLDivElement | null = null;

	const formatDateString = (date: Date) =>
		`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
	const localToday = () => formatDateString(new Date());
	const dateStringNDaysAgo = (days: number) => {
		const d = new Date();
		d.setDate(d.getDate() - days);
		return formatDateString(d);
	};
	const parseLocalDate = (dateStr: string): Date | null => {
		const [yearStr, monthStr, dayStr] = dateStr.split('-');
		const year = Number(yearStr);
		const month = Number(monthStr);
		const day = Number(dayStr);
		if (
			Number.isNaN(year) ||
			Number.isNaN(month) ||
			Number.isNaN(day) ||
			month < 1 ||
			month > 12 ||
			day < 1 ||
			day > 31
		) {
			return null;
		}
		return new Date(year, month - 1, day);
	};
	const formatDisplayDate = (
		dateStr: string,
		options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
	) => {
		const parsed = parseLocalDate(dateStr);
		if (!parsed) return dateStr;
		return parsed.toLocaleDateString(undefined, options);
	};
	const todayLabel = formatDisplayDate(localToday());

	function updateTrackedPlayersFromPeople(list: Person[]) {
		const next = { ...trackedDisplays };
		for (const def of TRACKED_PLAYERS) {
			const match = list.find((person) => {
				const label = person.label.toLowerCase();
				return def.tokens.some((token) => label.includes(token));
			});
			next[def.key] = {
				label: match?.label ?? def.fallbackLabel,
				user_id: match?.user_id ?? null
			};
		}
		trackedDisplays = next;
	}

	function emptyHistoryRecord(): Record<TrackedPlayerKey, number | null> {
		return TRACKED_PLAYERS.reduce(
			(acc, player) => ({ ...acc, [player.key]: null }),
			{} as Record<TrackedPlayerKey, number | null>
		);
	}

	function combinedPercent(values: Record<TrackedPlayerKey, number | null>): number | null {
		const percents = TRACKED_PLAYERS.map((player) => values[player.key]).filter(
			(pct): pct is number => typeof pct === 'number'
		);
		if (percents.length !== TRACKED_PLAYERS.length) return null;
		const product = percents.reduce((acc, pct) => acc * (pct / 100), 1);
		return Math.round(product * 100);
	}

	async function loadTrackedPlayerHistory() {
		const ids = Object.values(trackedDisplays)
			.map((display) => display.user_id)
			.filter((id): id is string => Boolean(id));
		if (ids.length === 0) {
			dayHistoryRows = [];
			return;
		}
		dayHistoryLoading = true;
		const today = localToday();
		const startDate = dateStringNDaysAgo(HISTORY_LOOKBACK_DAYS);
		const idToKey = new Map(
			Object.entries(trackedDisplays)
				.filter(([, display]) => display.user_id)
				.map(([key, display]) => [display.user_id as string, key as TrackedPlayerKey])
		);
		try {
			const { data, error } = await supabase
				.from('day_block_stats')
				.select('user_id, date, filled_blocks')
				.in('user_id', ids)
				.gte('date', startDate)
				.order('date', { ascending: false });
			if (error) throw error;

			const rows = new Map<string, Record<TrackedPlayerKey, number | null>>();
			for (const row of data ?? []) {
				const date = (row.date as string | null) ?? null;
				const userId = (row.user_id as string | null) ?? null;
				if (!date || date === today || !userId) continue;
				const key = idToKey.get(userId);
				if (!key) continue;
				const filled = Number(row.filled_blocks ?? 0);
				if (Number.isNaN(filled)) continue;
				const pct = Math.max(0, Math.min(100, Math.round((filled / TOTAL_BLOCKS_PER_DAY) * 100)));
				if (!rows.has(date)) rows.set(date, emptyHistoryRecord());
				rows.get(date)![key] = pct;
			}

			dayHistoryRows = Array.from(rows.entries())
				.sort((a, b) => (a[0] > b[0] ? -1 : 1))
				.map(([date, values]) => ({ date, values }));
		} catch (error) {
			console.error('tracked player history load error', error);
			dayHistoryRows = [];
		} finally {
			dayHistoryLoading = false;
		}
	}

	async function refreshTrackedPlayers() {
		try {
			const { data: rows, error } = await supabase
				.from('users')
				.select('id, display_name')
				.order('display_name', { ascending: true });
			if (error) throw error;
			const people = (rows ?? []).map((row) => ({
				label: row.display_name as string,
				user_id: row.id as string
			}));
			updateTrackedPlayersFromPeople(people);
			await loadTrackedPlayerHistory();
		} catch (error) {
			console.error('tracked player load error', error);
			dayHistoryRows = [];
		}
	}

	onMount(() => {
		let mounted = true;
		const init = async () => {
			try {
				const { data } = await supabase.auth.getUser();
				if (!mounted) return;
				applyUser(data.user ?? null);
			} catch {
				if (!mounted) return;
				applyUser(null);
			}
			if (!mounted) return;
			await refreshTrackedPlayers();
		};
		void init();

		const handleDocumentClick = (event: MouseEvent) => {
			if (!dayHistoryOpen || !dateMenuEl) return;
			if (!dateMenuEl.contains(event.target as Node)) {
				dayHistoryOpen = false;
			}
		};
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && dayHistoryOpen) {
				dayHistoryOpen = false;
			}
		};
		document.addEventListener('click', handleDocumentClick);
		document.addEventListener('keydown', handleKeyDown);

		return () => {
			mounted = false;
			document.removeEventListener('click', handleDocumentClick);
			document.removeEventListener('keydown', handleKeyDown);
		};
	});

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<OnlineCount dedupe={false} />
<div
	class="pointer-events-none fixed top-4 left-4 z-50 flex flex-col items-start"
	bind:this={dateMenuEl}
>
	<div class="pointer-events-auto relative">
		<button
			type="button"
			class="flex items-center gap-2 rounded-md px-2 py-1 text-sm font-semibold text-stone-700 transition hover:bg-stone-200/50"
			onclick={() => {
				dayHistoryOpen = !dayHistoryOpen;
			}}
			aria-expanded={dayHistoryOpen}
		>
			<span>{todayLabel}</span>
		</button>
		{#if dayHistoryOpen}
			<div
				class="absolute top-full left-0 z-50 mt-2 flex bg-blue-400 text-sm text-stone-700"
				role="dialog"
				aria-label="Previous days completion"
			>
				{#if dayHistoryRows.length === 0}
					<div class="text-sm text-stone-500">No recent history yet.</div>
				{:else}
					{#each dayHistoryRows as row}
						{@const jointPct = combinedPercent(row.values)}
						<div class="flex flex-row items-center justify-between gap-10 px-2">
							<div class="flex-1 shrink-0 text-sm font-semibold whitespace-nowrap text-stone-500">
								{formatDisplayDate(row.date, {
									month: 'short',
									day: 'numeric'
								})}
							</div>
							<div class="text-sm font-semibold text-stone-800">{jointPct ?? '—'}%</div>
						</div>
					{/each}
				{/if}
			</div>
		{/if}
	</div>
</div>
{@render children()}
