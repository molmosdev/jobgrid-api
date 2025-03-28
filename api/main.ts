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
  // Obtener el código de autorización de la query string
  const code = c.req.query("code");

  if (!code) {
    return c.json({ error: "Código de autorización faltante" }, 400);
  }

  try {
    // Crear un cliente de Supabase en el servidor
    const supabase = config.database.auth;

    // Intercambiar el código por una sesión
    const { data, error } = await supabase.exchangeCodeForSession(code);

    if (error) {
      console.error("Error al intercambiar el código:", error);
      return c.json({ error: "Falló el intercambio de código" }, 500);
    }

    // Redirigir al usuario a la URL deseada
    return c.json(data, 200);
  } catch (err) {
    console.error("Error inesperado:", err);
    return c.json({ error: "Ocurrió un error inesperado" }, 500);
  }
});

Deno.serve(app.fetch);
