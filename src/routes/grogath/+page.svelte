<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { getContext, onMount } from 'svelte';
	import type { Session } from '$lib/session';
	import type { Writable } from 'svelte/store';
	import { goto } from '$app/navigation';

	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let message = $state('');
	let messageType = $state<'error' | 'success' | ''>('');

	const session = getContext<Writable<Session>>('session');

	onMount(() => {
		if (!session) return;
		const unsub = session.subscribe((value) => {
			if (!value.loading && value.user) {
				void goto('/');
			}
		});
		return () => unsub();
	});

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (loading) return;
		loading = true;
		message = '';
		messageType = '';
		try {
			const { data, error } = await supabase.auth.signInWithPassword({ email, password });
			if (error) throw error;
			const user = data.user ?? null;
			if (session && user) {
				session.set({
					user,
					name: user.user_metadata?.name ?? '',
					loading: false
				});
			}
			messageType = 'success';
			message = 'Signed in. Redirecting…';
			setTimeout(() => void goto('/'), 600);
		} catch (err) {
			console.error('sign in error', err);
			messageType = 'error';
			message = err instanceof Error ? err.message : 'Unable to sign in.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Sign in • Momentum</title>
</svelte:head>

<div
	class="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-stone-950 px-4 py-10 text-stone-50"
>
	<div class="pointer-events-none absolute inset-0 flex">
		<div
			class="h-full w-1/2 bg-cover bg-center opacity-40"
			style="background-image:url('/graves.jpg');"
		></div>
		<div
			class="h-full w-1/2 bg-cover bg-center opacity-40"
			style="background-image:url('/toycho.jpg');"
		></div>
	</div>
	<div
		class="absolute inset-0 bg-gradient-to-b from-stone-950/80 via-stone-950/60 to-stone-950"
	></div>
	<div
		class="relative z-10 w-full max-w-xl rounded-2xl border border-white/10 bg-white/85 p-6 text-stone-900 shadow-[0_25px_60px_rgba(15,15,15,0.35)] backdrop-blur"
	>
		<div class="mb-5 space-y-1 text-center text-stone-600">
			<p class="text-3xl font-semibold tracking-tight text-stone-900">welcome back jittington</p>
		</div>
		<form class="space-y-4" onsubmit={handleSubmit}>
			<label class="block text-xs font-semibold text-stone-600">
				Email
				<input
					type="email"
					required
					class="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 transition outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
					placeholder="you@example.com"
					bind:value={email}
				/>
			</label>

			<label class="block text-xs font-semibold text-stone-600">
				Password
				<input
					type="password"
					required
					minlength="6"
					class="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 transition outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
					placeholder="••••••••"
					bind:value={password}
				/>
			</label>

			<button
				type="submit"
				class="flex w-full items-center justify-center rounded-xl border border-stone-200 bg-stone-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 focus-visible:ring-2 focus-visible:ring-stone-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
				disabled={loading}
			>
				{#if loading}
					its time…
				{:else}
					lock in
				{/if}
			</button>
		</form>
		<a
			class="mt-6 flex items-center justify-center text-xs font-medium text-stone-500 underline-offset-2 hover:underline"
			href="/"
		>
			Back to dashboard
		</a>
	</div>
</div>
