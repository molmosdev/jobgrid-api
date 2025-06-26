import { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { getCookie, setCookie } from "hono/cookie";

export const corsMiddleware: MiddlewareHandler = async (c, next) => {
  const origin = c.req.header("Origin");
  const env = c.env as { VALID_DOMAINS: KVNamespace };

  if (!origin) return await next();

  const hostname = new URL(origin).hostname;
  const domainMeta = await env.VALID_DOMAINS.get(hostname);

  if (!domainMeta && c.env.PRODUCTION === "true") {
    return c.text("Forbidden (CORS)", 403);
  }

  const isLocal = c.env.PRODUCTION === "false";

  setCookie(c, "origin", origin, {
    httpOnly: true,
    secure: isLocal ? false : true,
    sameSite: "Lax",
    path: "/",
    domain: isLocal ? undefined : "jobgrid.app",
  });

  getCookie(c, "origin"); // Ensure the cookie is set

  return cors({
    origin,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Origin", "Content-Type", "Authorization", "Accept"],
  })(c, next);
};
