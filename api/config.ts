import { createClient } from "@supabase";

export default {
  production: Deno.env.get("PRODUCTION")!,
  supabaseClient: createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      auth: {
        flowType: "pkce",
      },
    },
  ),
};
