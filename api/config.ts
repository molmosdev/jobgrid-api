import { createClient } from "@supabase";

export default {
  production: true,
  database: createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  ),
};
