import { createClient } from "@supabase";

export default {
  production: Deno.env.get("PRODUCTION")!,
  database: createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  ),
};
