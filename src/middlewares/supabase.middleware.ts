import { MiddlewareHandler } from "hono";
import { createClient } from "@supabase/supabase-js";

export const supabaseMiddleware: MiddlewareHandler = async (c, next) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SECRET_KEY);
  c.set("supabase", supabase);
  await next();
};
