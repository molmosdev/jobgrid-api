import { Context, MiddlewareHandler, Next } from "hono";

export const userMiddleware: MiddlewareHandler = async (
  c: Context,
  next: Next
) => {
  const supabase = c.get("supabase");

  const { data, error } = await supabase.auth.getUser();

  if (error) console.log("error", error);

  if (!data?.user) {
    return c.json({
      message: "You are not logged in.",
    }, 401);
  }

  c.set("user", data.user);

  await next();
};
