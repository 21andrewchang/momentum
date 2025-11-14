// $lib/presence.ts
import { browser } from '$app/environment';
import { readable, type Readable } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';

export type PresenceSnapshot = {
	tabs: number;
	unique: number;    // NOT de-duped; equals total sessions in pool
	connected: boolean;
};

type PresenceMeta = {
	user_id: string | null;
	room: string;
	ts: number;
};

const GLOBAL_ROOM = '__global__';

export function usePresence(room: string, userId: string | null): Readable<PresenceSnapshot> {
	const normalizedRoom = room || '/';

	return readable<PresenceSnapshot>({ tabs: 0, unique: 0, connected: false }, (set) => {
		if (!browser || typeof window === 'undefined' || typeof crypto === 'undefined') {
			return () => { };
		}

		let disposed = false;
		const sessionId = crypto.randomUUID();

		// Per-page room (optional; useful if you need page-local presence later)
		const roomChannel = supabase.channel(`presence:${normalizedRoom}`, {
			config: { presence: { key: sessionId } }
		});

		// Global pool: this is what we *read* to compute totals
		const globalChannel = supabase.channel(`presence:${GLOBAL_ROOM}`, {
			config: { presence: { key: sessionId } }
		});

		const handleGlobalSync = () => {
			const state = globalChannel.presenceState<PresenceMeta>();
			let tabs = 0;
			let unique = 0; // no de-dupe; count every meta entry

			for (const key in state) {
				const metas = state[key] ?? [];
				tabs += metas.length;
				unique += metas.length; // <-- no Set, no user_id union
			}

			if (!disposed) set({ tabs, unique, connected: true });
		};

		globalChannel.on('presence', { event: 'sync' }, handleGlobalSync);

		const payload: PresenceMeta = { user_id: userId, room: normalizedRoom, ts: Date.now() };

		roomChannel.subscribe((status) => { if (status === 'SUBSCRIBED') void roomChannel.track(payload); });
		globalChannel.subscribe((status) => { if (status === 'SUBSCRIBED') void globalChannel.track(payload); });

		const beforeUnload = () => cleanup();
		window.addEventListener('beforeunload', beforeUnload);

		function cleanup() {
			if (disposed) return;
			disposed = true;
			window.removeEventListener('beforeunload', beforeUnload);
			void roomChannel.untrack();
			void globalChannel.untrack();
			roomChannel.unsubscribe();
			globalChannel.unsubscribe();
			set({ tabs: 0, unique: 0, connected: false });
		}

		return cleanup;
	});
}

// Optional convenience if you want to call this explicitly:
export function useGlobalPresence(userId: string | null) {
	return usePresence('__global__', userId);
}
