import { Hono } from "hono";
import {
  deleteCookie,
  getCookie,
  getSignedCookie,
  setCookie,
  setSignedCookie,
} from "hono/cookie";
import { crypto } from "https://deno.land/std@0.198.0/crypto/mod.ts";

// Verificar variables de entorno
const LINKEDIN_CLIENT_ID = Deno.env.get("LINKEDIN_CLIENT_ID");
const LINKEDIN_CLIENT_SECRET = Deno.env.get("LINKEDIN_CLIENT_SECRET");
const LINKEDIN_REDIRECT_URI = Deno.env.get("LINKEDIN_REDIRECT_URI");
const COOKIE_SECRET = Deno.env.get("COOKIE_SECRET")!;

if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET || !LINKEDIN_REDIRECT_URI) {
  throw new Error("Missing required environment variables");
}

const LINKEDIN_SCOPE = "r_liteprofile r_emailaddress";
const COOKIE_OPTIONS = {
  secure: true,
  sameSite: "Lax" as const,
  path: "/",
  httpOnly: true,
  maxAge: 3600, // 1 hora
};

const app = new Hono();

app.get("/", (c) =>
  c.text("Bienvenido! Usa /auth/linkedin para iniciar sesión")
);

app.get("/auth/linkedin", async (c) => {
  const state = crypto.randomUUID();

  // Guardar estado firmado en cookie
  await setSignedCookie(c, "__Host-state", state, COOKIE_SECRET, {
    ...COOKIE_OPTIONS,
    prefix: "host",
  });

  const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("client_id", LINKEDIN_CLIENT_ID);
  authUrl.searchParams.append("redirect_uri", LINKEDIN_REDIRECT_URI);
  authUrl.searchParams.append("scope", LINKEDIN_SCOPE);
  authUrl.searchParams.append("state", state);

  return c.redirect(authUrl.toString(), 302);
});

app.get("/auth/linkedin/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");

  // Verificar estado firmado
  const savedState = await getSignedCookie(c, COOKIE_SECRET, "__Host-state");
  deleteCookie(c, "__Host-state");

  if (!state || state !== savedState) {
    return c.text("Invalid state parameter", 401);
  }

  if (!code) {
    return c.text("Missing authorization code", 400);
  }

  try {
    // Obtener token de acceso
    const tokenResponse = await fetch(
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: LINKEDIN_REDIRECT_URI,
          client_id: LINKEDIN_CLIENT_ID,
          client_secret: LINKEDIN_CLIENT_SECRET,
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return c.redirect(
        `/error?message=${encodeURIComponent(tokenData.error_description)}`
      );
    }

    // Obtener datos del usuario
    const [profileResponse, emailResponse] = await Promise.all([
      fetch("https://api.linkedin.com/v2/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }),
      fetch(
        "https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))",
        {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        }
      ),
    ]);

    if (!profileResponse.ok || !emailResponse.ok) {
      return c.redirect("/error?message=Error fetching user data");
    }

    const profileData = await profileResponse.json();
    const emailData = await emailResponse.json();

    // Guardar datos de usuario en cookies seguras
    const userData = {
      id: profileData.id,
      name: `${profileData.localizedFirstName} ${profileData.localizedLastName}`,
      email: emailData.elements?.[0]?.["handle~"]?.emailAddress,
    };

    setCookie(c, "__Host-user", JSON.stringify(userData), {
      ...COOKIE_OPTIONS,
      prefix: "host",
      maxAge: 3600, // 1 hora
    });

    return c.redirect("/profile");
  } catch (error) {
    console.error("Authentication error:", error);
    return c.redirect("/error");
  }
});

app.get("/profile", (c) => {
  const userCookie = getCookie(c, "__Host-user");
  if (!userCookie) return c.redirect("/auth/linkedin");

  try {
    const user = JSON.parse(userCookie);
    return c.json({
      name: user.name,
      email: user.email,
      linkedInId: user.id,
    });
  } catch {
    deleteCookie(c, "__Host-user");
    return c.redirect("/auth/linkedin");
  }
});

app.get("/logout", (c) => {
  deleteCookie(c, "__Host-user");
  return c.redirect("/");
});

app.get("/error", (c) => {
  const message = c.req.query("message") || "Unknown error occurred";
  return c.text(`Error: ${message}`, 500);
});

Deno.serve(app.fetch);
