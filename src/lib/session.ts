import type { User } from '@supabase/supabase-js';

export type Session = {
	user: User | null;
	name: string;
	loading: boolean;
};
