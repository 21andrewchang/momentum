<script lang="ts">
	import { fade, scale } from 'svelte/transition';

	let {
		open = false,
		onClose = () => {},
		onSave = () => {}
	} = $props<{
		open?: boolean;
		onClose?: () => void;
		onSave?: (text: string, todo: boolean | null) => void;
	}>();

	let text = $state('');
	let todo = $state<boolean | null>(null);
	let saving = $state(false);
	let inputEl: HTMLInputElement | null = $state(null);

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onClose();
	}
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}

	function currentSlot(): { hour: number; half: 0 | 1 } {
		const now = new Date();
		const hour = now.getHours();
		const half = (now.getMinutes() < 30 ? 0 : 1) as 0 | 1;
		return { hour, half };
	}

	async function handleSubmit() {
		const value = text.trim();
		if (!value || saving) return;
		saving = true;
		try {
			onSave(value, todo);
			text = '';
			todo = null;
			onClose();
		} finally {
			saving = false;
		}
	}

	// autofocus when opened
	$effect(() => {
		if (open) queueMicrotask(() => inputEl?.focus());
	});

	function fillPreset(s: string) {
		text = s;
		queueMicrotask(() => inputEl?.focus());
	}
</script>

{#if open}
	<div
		in:fade={{ duration: 150 }}
		class="fixed inset-0 z-[120] flex items-center justify-center bg-stone-50/80"
		role="dialog"
		aria-modal="true"
		aria-label="New log"
		tabindex="-1"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
	>
		<div
			in:scale={{ start: 0.95, duration: 160 }}
			class="w-full max-w-lg rounded-xl border border-stone-200 bg-white/95 text-stone-800 shadow-[0_12px_32px_rgba(15,15,15,0.12)]"
		>
			<div class="flex w-full flex-row items-center">
				<input
					bind:this={inputEl}
					type="text"
					placeholder="Title"
					class="w-full p-6 px-5 text-2xl text-stone-800 transition outline-none"
					bind:value={text}
					autocomplete="off"
				/>
				{#if todo === false}
					<div class="relative mr-5 grid h-3 w-3 rounded-full p-3">
						<span
							class="pointer-events-none absolute inset-0 rounded-full border border-[1px] border-stone-400 transition duration-200 ease-out"
						/>
					</div>
				{/if}
			</div>

			<div class="flex flex-row gap-1 px-4 pb-4">
				<button
					type="button"
					class="inline-flex items-center justify-center rounded-lg border border-stone-200 px-2 py-1 text-xs font-medium text-stone-900 transition"
					onclick={() => fillPreset('Read')}
				>
					Read
				</button>
				<button
					type="button"
					class="inline-flex items-center justify-center rounded-lg border border-stone-200 px-2 py-1 text-xs font-medium text-stone-900 transition"
					onclick={() => fillPreset('Meditate')}
				>
					Meditate
				</button>
				<button
					type="button"
					class="inline-flex items-center justify-center rounded-lg border border-stone-200 px-2 py-1 text-xs font-medium text-stone-900 transition"
					onclick={() => fillPreset('Gym')}
				>
					Gym
				</button>
			</div>
			<div class="flex items-center justify-between gap-2 border-t border-stone-200 p-4 py-3">
				<button
					class={`inline-flex items-center justify-center rounded-lg border border-stone-200 ${todo === null ? 'bg-stone-50 text-stone-900' : 'bg-stone-900 text-stone-50'} px-2 py-1 text-xs font-medium  transition  focus-visible:outline-none`}
					onclick={() => {
						if (todo === null) todo = false;
						else todo = null;
					}}
				>
					Todo
				</button>
				<button
					class="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-stone-900 px-2 py-1 text-xs font-medium text-white transition hover:bg-stone-800 focus-visible:ring-2 focus-visible:ring-stone-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
					disabled={!text.trim() || saving}
					onclick={handleSubmit}
				>
					{saving ? 'Saving…' : 'Save log'}
				</button>
			</div>
		</div>
	</div>
{/if}
