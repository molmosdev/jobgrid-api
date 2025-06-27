import { Context, Hono } from "hono";
import { userMiddleware } from "../middlewares/user.middleware";
import { setCookie, getCookie } from "hono/cookie";

const app = new Hono();

app.post("/login", async (c: Context) => {
  const { email, password } = await c.req.json();

  if (!email || !password) {
    return c.json({ message: "Email and password are required" }, 400);
  }

  const supabase = c.get("supabase");

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("Error during email/password login:", error);
    return c.json({ error: "Authentication failed" }, 401);
  }

  return c.json({ message: "Login successful" }, 200);
});

app.get("/linkedin/login", async (c: Context) => {
  const supabase = c.get("supabase");
  setCookie(c, "referer", c.req.header("referer") || "/", {
    httpOnly: true,
    secure: c.env.PRODUCTION === "false" ? false : true,
    sameSite: "Lax",
    path: "/",
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "linkedin_oidc",
    options: {
      redirectTo: c.env.LINKEDIN_REDIRECT_URI,
    },
  });

  if (error) {
    console.error("Error during LinkedIn OAuth:", error);
    return c.json({ error: "Authentication failed" }, 500);
  }

  return c.redirect(data.url);
});

app.get("/linkedin/callback", async (c: Context) => {
  const referer = getCookie(c, "referer");
  let finalizeUrl = "";

  if (!referer) {
    return c.text("Missing referer", 400);
  }

  try {
    const url = new URL(referer);

    if (
      url.hostname === "localhost" &&
      (url.port === "4200" || url.port === "")
    ) {
      url.port = "8787";
      url.protocol = "http:";
      finalizeUrl = url.origin;
    } else {
      // Si ya empieza por api., no lo añade de nuevo
      if (!url.hostname.startsWith("api.")) {
        url.hostname = "api." + url.hostname;
      }
      finalizeUrl = url.origin;
    }
  } catch (e) {
    return c.text("Invalid referer", 400);
  }

  const code = c.req.query("code");
  const error = c.req.query("error");

  if (error || !code) {
    return c.redirect(`${finalizeUrl}?error=oauth_failed`);
  }

  const redirectUrl = new URL(finalizeUrl);
  redirectUrl.pathname = "/auth/linkedin/finalize";
  redirectUrl.searchParams.set("code", code);
  redirectUrl.searchParams.set("referer", referer);

  console.log(redirectUrl.toString());

  return c.redirect(redirectUrl.toString());
});

app.get("/linkedin/finalize", async (c: Context) => {
  const code = c.req.query("code");
  const referer = c.req.query("referer");

  if (!code) {
    return c.json({ error: "Code not provided" }, 400);
  }

  const supabase = c.get("supabase");
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error("Error during LinkedIn callback:", error);
    return c.json({ error: "Authentication failed" }, 500);
  }

  return c.redirect(referer || "/");
});

app.get("/user", userMiddleware, async (c: Context) => {
  return c.json(c.get("user"), 200);
});

app.get("/logout", userMiddleware, async (c: Context) => {
  const supabase = c.get("supabase");

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Error during logout:", error);
    return c.json({ error: "Logout failed" }, 500);
  }

  c.set("user", null);
  return c.json({ message: "Logout successful" }, 200);
});

app.post("/register", async (c: Context) => {
  const { email, password, given_name, family_name, picture } =
    await c.req.json();

  if (!email || !password || !given_name || !family_name) {
    return c.json(
      {
        message: "Email, password, given name, and family name are required",
      },
      400
    );
  }

  const supabase = c.get("supabase");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        given_name,
        family_name,
        picture,
      },
    },
  });

  if (error) {
    console.error("Error during registration:", error);
    return c.json({ error: "Registration failed" }, 400);
  }

  return c.json({ message: "Registration successful", user: data.user }, 201);
});

export default app;
