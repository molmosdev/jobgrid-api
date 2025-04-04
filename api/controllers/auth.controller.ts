import { Context } from "hono";
import config from "@config";
import { setCookie } from "hono/cookie";

class AuthController {
  static async loginWithEmailAndPassword(c: Context) {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ message: "Email and password are required" }, 400);
    }

    const { data, error } = await config.supabaseClient.auth.signInWithPassword(
      {
        email,
        password,
      },
    );

    if (error) {
      console.error("Error during email/password login:", error);
      return c.json({ error: "Authentication failed" }, 401);
    }

    setCookie(c, "access_token", data.session.access_token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60,
      sameSite: "none",
      secure: true,
    });

    return c.json({ message: "Login successful" }, 200);
  }

  static async logInWithLinkedIn(c: Context) {
    const { data, error } = await config.supabaseClient.auth.signInWithOAuth({
      provider: "linkedin_oidc",
      options: {
        redirectTo: Deno.env.get("LINKEDIN_REDIRECT_URI")!,
      },
    });

    if (error) {
      console.error("Error durante LinkedIn OAuth:", error);
      return c.json({ error: "Authentication failed" }, 500);
    }

    return c.redirect(data.url);
  }

  static async linkedInCallback(c: Context) {
    const code = c.req.query("code");
    if (!code) {
      return c.json({ error: "Code not provided" }, 400);
    }

    const supabase = config.supabaseClient;
    const session = await supabase.auth.exchangeCodeForSession(code);

    if (session.error) {
      console.error("Error during LinkedIn callback:", session.error);
      return c.json({ error: "Authentication failed" }, 500);
    }

    const accessToken = session.data.session.access_token;

    if (accessToken) {
      setCookie(c, "access_token", accessToken, {
        httpOnly: true,
        maxAge: 24 * 60 * 60,
        sameSite: "none",
        secure: true,
      });
    } else {
      console.error("Access token not found in session data.");
      return c.json({ error: "Authentication failed" }, 500);
    }

    return c.redirect("https://jobgrid.app");
  }

  static getUser(c: Context) {
    return c.json(c.get("user"), 200);
  }

  static logout(c: Context) {
    setCookie(c, "access_token", "", {
      httpOnly: true,
      maxAge: -1,
      sameSite: "none",
      secure: true,
    });

    c.set("user", null);
    return c.json({ message: "Session ended" }, 200);
  }
}

export default AuthController;
