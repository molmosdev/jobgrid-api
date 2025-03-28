import { Hono } from "hono";
import config from "@config";

const app = new Hono();
app.get("/", (c) => c.text("Hello, World 2!"));

app.get("/auth/linkedin", async (c) => {
  const { data, error } = await config.database.auth.signInWithOAuth({
    provider: "linkedin_oidc",
    options: {
      redirectTo: "https://api.jobgrid.app/auth/linkedin/callback",
    },
  });

  if (error) {
    console.error("Error durante LinkedIn OAuth:", error);
    return c.json({ error: "Authentication failed" }, 500);
  }

  return c.redirect(data.url);
});

app.get("/auth/linkedin/callback", async (c) => {
  const code = new URL(c.req.url).searchParams.get("code");

  if (!code) {
    return c.json({ error: "Código de autorización faltante" }, 400);
  }

  const { data, error } = await config.database.auth.exchangeCodeForSession(
    code
  );

  if (error) {
    console.error("Error en el callback:", error);
    return c.json({ error: "Falló el intercambio de código" }, 500);
  }

  return c.json(data, 200);
});
Deno.serve(app.fetch);
