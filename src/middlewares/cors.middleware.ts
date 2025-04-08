import { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";

export const corsMiddleware: MiddlewareHandler = async (c, next) => {
  const origin = c.env.CLIENT_STATIC_URL;
  c.set("domain", new URL(c.env.CLIENT_STATIC_URL).hostname);

  return cors({
    origin,
    credentials: true,
  })(c, next);
};
