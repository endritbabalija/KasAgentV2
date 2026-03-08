import { createClient } from "@supabase/supabase-js";

// Server-side only — uses service role key to bypass RLS.
// Never import this from client components.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseServiceKey);
