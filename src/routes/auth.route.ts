import { Context, Hono } from "hono";
import { userMiddleware } from "../middlewares/user.middleware";
import * as jose from "jose";
import { setCookie } from "hono/cookie";

const app = new Hono();

app.get("/linkedin/login", async (c: Context) => {
  const isLocal = c.env.PRODUCTION === "false";
  const protocol = isLocal ? "http" : "https";
  const host = c.req.header("x-forwarded-host") || c.req.header("host");
  const redirectUri = `${protocol}://${host}/auth/linkedin/callback`;

  const authUrl = new URL(`https://${c.env.AUTH0_DOMAIN}/authorize`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", c.env.AUTH0_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "openid profile email");
  authUrl.searchParams.set("connection", "linkedin");

  return c.redirect(authUrl.toString());
});

app.get("/linkedin/callback", async (c: Context) => {
  const code = c.req.query("code");
  if (!code) return c.text("Missing code", 400);

  const isLocal = c.env.PRODUCTION === "false";
  const protocol = isLocal ? "http" : "https";
  const host = c.req.header("x-forwarded-host") || c.req.header("host");
  const redirectUri = `${protocol}://${host}/auth/linkedin/callback`;

  const tokenUrl = `https://${c.env.AUTH0_DOMAIN}/oauth/token`;
  const body = {
    grant_type: "authorization_code",
    client_id: c.env.AUTH0_CLIENT_ID,
    client_secret: c.env.AUTH0_CLIENT_SECRET,
    code,
    redirect_uri: redirectUri,
  };

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.text();
    return c.text(`Error fetching token: ${error}`, 500);
  }

  const data = (await res.json()) as { id_token: string; access_token: string };

  // Create signed session token
  const secret = new TextEncoder().encode(c.env.COOKIE_SECRET);
  const sessionToken = await new jose.SignJWT({
    id_token: data.id_token,
    access_token: data.access_token,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("2h")
    .sign(secret);

  // Set session cookie
  setCookie(c, "session", sessionToken, {
    httpOnly: true,
    secure: !isLocal,
    sameSite: "Lax",
    path: "/",
    maxAge: 2 * 60 * 60,
  });

  const returnTo = isLocal
    ? "http://localhost:4200/"
    : `${protocol}://${host}/`;

  return c.redirect(returnTo, 302);
});

app.get("/user", userMiddleware, async (c: Context) => {
  const session = c.get("user");
  if (!session) return c.text("Unauthorized", 401);

  // Decode idToken to get user profile
  const profile = session.idToken ? jose.decodeJwt(session.idToken) : null;

  return c.json(profile);
});

app.get("/logout", (c: Context) => {
  const isLocal = c.env.PRODUCTION === "false";
  setCookie(c, "session", "", {
    httpOnly: true,
    secure: !isLocal,
    path: "/",
    maxAge: 0,
  });

  // Build Auth0 logout URL
  const protocol = c.req.header("x-forwarded-proto") || "http";
  let host = c.req.header("x-forwarded-host") || c.req.header("host") || "";
  if (!isLocal && host.startsWith("api.")) {
    host = host.replace(/^api\./, "");
  }
  const returnTo = isLocal
    ? "http://localhost:4200/"
    : `${protocol}://${host}/`;
  const logoutUrl = new URL(`https://${c.env.AUTH0_DOMAIN}/v2/logout`);
  logoutUrl.searchParams.set("client_id", c.env.AUTH0_CLIENT_ID);
  logoutUrl.searchParams.set("returnTo", returnTo);

  return c.redirect(logoutUrl.toString(), 302);
});

export default app;
