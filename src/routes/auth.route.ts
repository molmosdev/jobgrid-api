import { Context, Hono } from "hono";
import { userMiddleware } from "../middlewares/user.middleware";
import { emailMagicLinkLimiter } from "../middlewares/rate-limit.middleware";
import * as jose from "jose";
import { setCookie } from "hono/cookie";

const app = new Hono();

// Helper: normalize email
const normEmail = (e: string) => e.trim().toLowerCase();

// Helper: get user row by email
async function getUserByEmail(supabase: any, email: string) {
  return supabase
    .from("users")
    .select("id, external_id, email, type")
    .eq("email", normEmail(email))
    .maybeSingle();
}

// Helper: get or create user by external id
async function ensureUserByExternal(supabase: any, opts: { externalId: string; email: string; name?: string; type: 'recruiter'|'seeker'; avatarUrl?: string }) {
  const externalId = opts.externalId;
  const email = normEmail(opts.email);
  const desiredName = (opts.name || "").trim();
  const { data: existing } = await supabase
    .from("users")
    .select("id, type, name, email, avatar_url")
    .eq("external_id", externalId)
    .maybeSingle();
  if (existing) {
    // Optionally enrich existing placeholder name (email or local part) with provided real name
    const emailLocal = email.split("@")[0];
    const placeholderNames = new Set([existing.email, existing.name === existing.email ? existing.name : null, emailLocal].filter(Boolean));
    const updates: Record<string, any> = {};
    if (desiredName && placeholderNames.has(existing.name) && desiredName !== existing.name) {
      updates.name = desiredName;
    }
    if (opts.avatarUrl && !existing.avatar_url) {
      updates.avatar_url = opts.avatarUrl;
    }
    if (Object.keys(updates).length) {
      await supabase.from("users").update(updates).eq("id", existing.id);
    }
    return existing.id;
  }
  const insertPayload: Record<string, any> = { external_id: externalId, email, name: desiredName || email.split("@")[0], type: opts.type };
  if (opts.avatarUrl) insertPayload.avatar_url = opts.avatarUrl;
  const { data: created, error } = await supabase.from("users").insert(insertPayload).select("id").maybeSingle();
  if (error) throw error;
  return created!.id;
}

// PASSWORDLESS OTP (code) REGISTRATION (recruiter)
app.post("/magic-link/register", emailMagicLinkLimiter, async (c: Context) => {
  const body = await c.req.json();
  const { name, email } = body;
  if (!name || !email) return c.json({ error: "Name and email are required." }, 400);

  const supabase = c.get("supabase");
  const { data: existing } = await getUserByEmail(supabase, email);
  if (existing) return c.json({ error: "Email is already registered." }, 409);

  const isLocal = c.env.PRODUCTION === "false";
  const host = c.req.header("x-forwarded-host") || c.req.header("host");
  const protocol = isLocal ? "http" : "https";
  const callback = `${protocol}://${host}/auth/linkedin/callback`;

  const payload = {
    client_id: c.env.AUTH0_CLIENT_ID,
    client_secret: c.env.AUTH0_CLIENT_SECRET,
    connection: "email",
    email,
    send: "code", // OTP code instead of magic link
    authParams: {
      scope: "openid profile email",
      redirect_uri: callback,
      state: "register",
      login_hint: email,
      display: name,
      response_type: "code"
    }
  };

  const res = await fetch(`https://${c.env.AUTH0_DOMAIN}/passwordless/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const txt = await res.text();
    return c.json({ error: `Auth0 error: ${txt}` }, 400);
  }
  return c.json({ message: "Verification code sent. Check your inbox.", state: "register" }, 200);
});

// PASSWORDLESS OTP (code) LOGIN (recruiter)
app.post("/magic-link/login", emailMagicLinkLimiter, async (c: Context) => {
  const body = await c.req.json();
  const { email } = body;
  if (!email) return c.json({ error: "Email is required." }, 400);
  const supabase = c.get("supabase");
  const { data: existing } = await getUserByEmail(supabase, email);
  if (!existing || existing.type !== 'recruiter') return c.json({ error: "No recruiter found with this email." }, 404);

  const isLocal = c.env.PRODUCTION === "false";
  const host = c.req.header("x-forwarded-host") || c.req.header("host");
  const protocol = isLocal ? "http" : "https";
  const callback = `${protocol}://${host}/auth/linkedin/callback`;

  const payload = {
    client_id: c.env.AUTH0_CLIENT_ID,
    client_secret: c.env.AUTH0_CLIENT_SECRET,
    connection: "email",
    email,
    send: "code",
    authParams: {
      scope: "openid profile email",
      redirect_uri: callback,
      state: "login",
      login_hint: email,
      response_type: "code"
    }
  };

  const res = await fetch(`https://${c.env.AUTH0_DOMAIN}/passwordless/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const txt = await res.text();
    return c.json({ error: `Auth0 error: ${txt}` }, 400);
  }
  return c.json({ message: "Verification code sent. Check your inbox.", state: "login" }, 200);
});

// PASSWORDLESS OTP VERIFICATION (email + code) -> creates recruiter account on register
app.post("/passwordless/verify", async (c: Context) => {
  const body = await c.req.json();
  const { email, code, state, name } = body as { email?: string; code?: string; state?: string; name?: string };
  if (!email || !code) return c.json({ error: "Email and code are required." }, 400);

  const tokenUrl = `https://${c.env.AUTH0_DOMAIN}/oauth/token`;
  const tokenPayload = {
    grant_type: "http://auth0.com/oauth/grant-type/passwordless/otp",
    client_id: c.env.AUTH0_CLIENT_ID,
    client_secret: c.env.AUTH0_CLIENT_SECRET,
    realm: "email", // connection name
    username: email,
    otp: code,
    scope: "openid profile email"
  };

  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tokenPayload)
  });
  if (!tokenRes.ok) {
    const txt = await tokenRes.text();
    return c.json({ error: `Invalid code: ${txt}` }, 400);
  }
  const data = (await tokenRes.json()) as { id_token: string; access_token: string };
  const decoded = jose.decodeJwt(data.id_token) as Record<string, any>;
  const decodedEmail = (decoded.email as string) || email;
  // Prefer explicit provided name over Auth0's (email connection often sets name=email)
  const displayName = (name || decoded.name || decoded.nickname || decodedEmail.split("@")[0]) as string;

  if (state === "register") {
    try {
      const supabase = c.get("supabase");
  await ensureUserByExternal(supabase, { externalId: decoded.sub as string, email: decodedEmail, name: displayName, type: 'recruiter', avatarUrl: decoded.picture as string | undefined });
    } catch (e) {
      console.error("Account upsert error", e);
    }
  }

  const isLocal = c.env.PRODUCTION === "false";
  const secret = new TextEncoder().encode(c.env.COOKIE_SECRET);
  const sessionToken = await new jose.SignJWT({ id_token: data.id_token, access_token: data.access_token })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("2h")
    .sign(secret);

  setCookie(c, "session", sessionToken, {
    httpOnly: true,
    secure: !isLocal,
    sameSite: "Lax",
    path: "/",
    maxAge: 2 * 60 * 60
  });

  return c.json({ redirect: state === "register" ? "/create-company" : "/", message: "Authenticated" }, 200);
});

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
  const state = c.req.query("state"); // register | login | undefined (linkedin)
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

  // Decode id_token to get profile (email, name, etc.)
  const decoded = jose.decodeJwt(data.id_token) as Record<string, any>;
  const email = decoded.email as string | undefined;
  // Build best-effort display name from LinkedIn claims
  const given = (decoded.given_name as string) || '';
  const family = (decoded.family_name as string) || '';
  const composite = (given || family) ? `${given} ${family}`.trim() : undefined;
  const displayName = (decoded.name || composite || decoded.nickname || decoded.display_name || undefined) as string | undefined;

  // Ensure seeker account exists (linkedin user). Treat any missing as seeker creation.
  if (email) {
    try {
      const supabase = c.get("supabase");
  await ensureUserByExternal(supabase, { externalId: decoded.sub as string, email, name: displayName, type: 'seeker', avatarUrl: decoded.picture as string | undefined });
    } catch (e) {
      console.error("Account upsert error (linkedin)", e);
    }
  }

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

  // Decide redirect target
  // For now always root; future: if state=register redirect to /create-company
  const baseHost = host?.replace(/^api\./, "");
  const returnTo = isLocal ? "http://localhost:4200/" : `${protocol}://${baseHost}/`;
  // Optionally differentiate register vs login
  const final = state === "register" ? `${returnTo}create-company` : returnTo;
  return c.redirect(final, 302);
});

app.get("/user", userMiddleware, async (c: Context) => {
  const session = c.get("user");
  if (!session) return c.text("Unauthorized", 401);
  const supabase = c.get("supabase");
  const decoded = session.idToken ? jose.decodeJwt(session.idToken) as Record<string, any> : null;
  if (!decoded?.sub) return c.text("Unauthorized", 401);

  const { data: userRow } = await supabase
    .from("users")
    .select("id, external_id, email, name, type, avatar_url")
    .eq("external_id", decoded.sub)
    .maybeSingle();
  if (!userRow) return c.text("Unauthorized", 401);

  const { data: cu } = await supabase
    .from("company_users")
    .select("company_id")
    .eq("user_id", userRow.id)
    .limit(1);
  const hasCompany = !!(cu && cu.length > 0);

  return c.json({ user: userRow, hasCompany });
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
  console.log("Host:", host);
  console.log(host.replace(/^api\./, ""));
  const returnTo = isLocal
    ? "http://localhost:4200/"
    : `${protocol}://${host.replace(/^api\./, "")}/`;
  const logoutUrl = new URL(`https://${c.env.AUTH0_DOMAIN}/v2/logout`);
  logoutUrl.searchParams.set("client_id", c.env.AUTH0_CLIENT_ID);
  logoutUrl.searchParams.set("returnTo", returnTo);

  return c.redirect(logoutUrl.toString(), 302);
});

export default app;
