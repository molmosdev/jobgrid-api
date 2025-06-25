import { MiddlewareHandler } from "hono";

export const corsMiddleware: MiddlewareHandler = async (c, next) => {
  const origin = c.req.header("Origin");
  const env = c.env as { VALID_DOMAINS: KVNamespace };

  // If no origin header, skip CORS
  if (!origin) return await next();

  const hostname = new URL(origin).hostname;

  const domainMeta = await env.VALID_DOMAINS.get(hostname);
  if (!domainMeta) {
    return c.text("Forbidden (CORS)", 403);
  }

  // Save the domain in the context for later use
  c.set("domain", hostname);

  c.header("Access-Control-Allow-Origin", origin);
  c.header("Access-Control-Allow-Credentials", "true");
  c.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  c.header(
    "Access-Control-Allow-Headers",
    "Origin, Content-Type, Authorization, Accept"
  );

  // Preflight
  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }

  await next();
};
