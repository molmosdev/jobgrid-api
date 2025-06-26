import { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";

export const corsMiddleware: MiddlewareHandler = async (c, next) => {
  const origin = c.req.header("Origin");
  const env = c.env as { VALID_DOMAINS: KVNamespace };

  if (!origin) return await next();

  const hostname = new URL(origin).hostname;
  const domainMeta = await env.VALID_DOMAINS.get(hostname);

  if (!domainMeta) {
    return c.text("Forbidden (CORS)", 403);
  }

  return cors({
    origin,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Origin", "Content-Type", "Authorization", "Accept"],
  })(c, next);
};
