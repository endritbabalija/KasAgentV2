import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

// Server-side only — uses service role key to bypass RLS.
// Never import this from client components.
export const supabase = createClient(
  serverEnv.NEXT_PUBLIC_SUPABASE_URL,
  serverEnv.SUPABASE_SERVICE_ROLE_KEY,
);
