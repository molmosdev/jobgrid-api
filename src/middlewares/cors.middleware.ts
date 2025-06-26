import { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { setCookie } from "hono/cookie";

export const corsMiddleware: MiddlewareHandler = async (c, next) => {
  const origin = c.req.header("Origin");
  const env = c.env as { VALID_DOMAINS: KVNamespace };

  if (!origin) return await next();

  const hostname = new URL(origin).hostname;
  const domainMeta = await env.VALID_DOMAINS.get(hostname);

  if (!domainMeta && c.env.PRODUCTION === "true") {
    return c.text("Forbidden (CORS)", 403);
  }

  setCookie(c, "origin", origin, {
    sameSite: "None",
    secure: c.env.PRODUCTION === "true",
    path: "/",
    httpOnly: false,
  });

  return cors({
    origin,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Origin", "Content-Type", "Authorization", "Accept"],
  })(c, next);
};
