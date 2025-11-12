<script lang="ts">
	import type { PlayerStatus } from '$lib/playerPresence';

	const props = $props<{ label?: string | null; status?: PlayerStatus; me?: boolean }>();

	const DOT_CLASSES: Record<PlayerStatus, string> = {
		online: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.65)]',
		away: 'bg-amber-400  shadow-[0_0_8px_rgba(251,191,36,0.65)]',
		offline: 'bg-rose-400   shadow-[0_0_8px_rgba(248,113,113,0.4)]'
	};
	const DOT_CLASS_ME = 'bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.55)]';

	const me = $derived(Boolean(props.me));
	const effectiveStatus: PlayerStatus = $derived(
		(me ? 'online' : (props.status ?? 'offline')) as PlayerStatus
	);
	const label: string | null = $derived(props.label ?? null);

	const TEXT_LABELS: Record<PlayerStatus, string> = {
		online: 'online',
		away: 'away',
		offline: 'offline'
	};

	// what to show as the status string (tooltip/aria)
	const statusText = $derived(me ? 'you' : TEXT_LABELS[effectiveStatus]);

	const dotClass = $derived(me ? DOT_CLASS_ME : DOT_CLASSES[effectiveStatus]);
	const aria = $derived(label ? `${label} is ${statusText}` : statusText);
</script>

<div
	class="group relative inline-flex items-center gap-2 rounded-md font-medium text-stone-700"
	aria-label={aria}
>
	<span class={`h-2 w-2 rounded-full ${dotClass}`}></span>
	{#if label}{label}{/if}

	<span
		role="tooltip"
		class="pointer-events-none absolute top-1/2 left-full ml-2 -translate-y-1/2 rounded-md
           bg-stone-900 px-2 py-1 text-[11px] font-medium whitespace-nowrap text-white capitalize opacity-0
           shadow-lg transition-opacity duration-150 group-hover:opacity-100"
	>
		{statusText}
	</span>
</div>
