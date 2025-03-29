import { Context, Next } from "hono";
import { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import config from "@config";

// Middleware for verifying JWT tokens with Supabase Admin SDK
const jwt: MiddlewareHandler = async (c: Context, next: Next) => {
  try {
    const token = getCookie(c, "access_token");

    if (!token) {
      return c.json({ message: "Access token is missing" }, 401);
    }

    // Verify the token
    const { data, error } = await config.database.auth.getUser(token);

    if (error || !data) {
      return c.json(
        { message: "Invalid token", error: error?.message || "Unknown error" },
        401,
      );
    }

    c.set("user", data.user);

    await next();
  } catch (error) {
    console.error("Error verifying token:", error);
    return c.json(
      {
        message: "Unauthorized",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      401,
    );
  }
};

export default jwt;
