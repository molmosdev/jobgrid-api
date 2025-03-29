import { Hono } from "hono";
import config from "@config";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";

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

  // Extraer el access_token de la URL (si está disponible)
  const url = new URL(data.url);
  const accessToken = url.searchParams.get("access_token");

  if (accessToken) {
    // Guardar el access_token en una cookie segura y temporal
    setCookie(c, "access_token", accessToken, {
      httpOnly: true,
      secure: true,
      maxAge: 3600, // 1 hora
      sameSite: "Strict",
      path: "/",
    });
  }

  return c.redirect(data.url);
});

app.get("/auth/linkedin/callback", async (c) => {
  // Recuperar el access_token desde la cookie
  const accessToken = getCookie(c, "access_token");

  if (!accessToken) {
    return c.json({ error: "Access token faltante en la cookie" }, 400);
  }

  try {
    // Crear una sesión usando el access_token
    const { data, error } = await config.database.auth.exchangeCodeForSession(
      accessToken
    );

    if (error) {
      console.error("Error al intercambiar el access_token:", error);
      return c.json({ error: "Falló el intercambio de access_token" }, 500);
    }

    // Eliminar la cookie después de usarla
    deleteCookie(c, "access_token", {
      path: "/",
      secure: true,
    });

    // Redirigir al usuario a una página de éxito o devolver la sesión
    return c.json(data, 200);
  } catch (err) {
    console.error("Error inesperado:", err);
    return c.json({ error: "Ocurrió un error inesperado" }, 500);
  }
});

Deno.serve(app.fetch);
