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
  const code = c.req.query("code");
  if (!code) {
    return c.json({ error: "Code not provided" }, 400);
  }

  const supabase = c.get("supabase");
  const session = await supabase.auth.exchangeCodeForSession(code);

  if (session.error) {
    console.error("Error during LinkedIn callback:", session.error);
    return c.json({ error: "Authentication failed" }, 500);
  }

  return c.redirect(getCookie(c, "referer") || "/");
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
