import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const CONNECTED = Boolean(url && key);

export const supabase: SupabaseClient | null = CONNECTED
  ? createClient(url as string, key as string, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 12 } },
    })
  : null;
