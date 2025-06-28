import { Context, Next } from "hono";
import * as jose from "jose";
import { getCookie } from "hono/cookie";

export async function userMiddleware(c: Context, next: Next) {
  try {
    const sessionToken = getCookie(c, "session");
    if (!sessionToken) {
      // No session, you can return 401 or continue without user
      return c.text("Unauthorized", 401);
    }

    const secret = new TextEncoder().encode(c.env.COOKIE_SECRET);

    // Verify and decode the session JWT
    const { payload } = await jose.jwtVerify(sessionToken, secret, {
      algorithms: ["HS256"],
    });

    // Optionally validate payload.id_token (e.g., decode it)
    // For simplicity, just pass the payload to the context
    // You can extract what you need to identify the user

    c.set("user", {
      idToken: payload.id_token,
      accessToken: payload.access_token,
    });

    // Continue with the next middleware/handler
    await next();
  } catch (err) {
    return c.text("Unauthorized - invalid session", 401);
  }
}
