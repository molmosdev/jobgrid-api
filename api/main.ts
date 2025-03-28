import { Hono } from "hono";
import config from "@config";

const app = new Hono();
app.get("/", (c) => c.text("Hello, World 2!"));

app.get("/auth/linkedin", async (c) => {
  const { data, error } = await config.database.auth.signInWithOAuth({
    provider: "linkedin_oidc",
    options: {
      redirectTo: "https://example.com/auth/linkedin/callback",
    },
  });

  if (error) {
    console.error("Error during LinkedIn OAuth:", error);
    return c.json({ error: "Authentication failed" }, 500);
  }

  c.json({ data }, 200);
});

/* app.get("/auth/linkedin/callback", (c) => {}); */

Deno.serve(app.fetch);
