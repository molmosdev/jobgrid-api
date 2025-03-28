import { Hono } from "hono";

const app = new Hono();

const LINKEDIN_CLIENT_ID = Deno.env.get("LINKEDIN_CLIENT_ID")!;
const LINKEDIN_REDIRECT_URI = Deno.env.get("LINKEDIN_REDIRECT_URI")!;

app.get("/", (c) => c.text("Hello, World!"));

app.get("/auth/linkedin", (c) => {
  const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("client_id", LINKEDIN_CLIENT_ID);
  authUrl.searchParams.append("scope", "r_liteprofile");
  authUrl.searchParams.append(
    "state",
    Math.random().toString(36).substring(2, 15),
  );
  authUrl.searchParams.append("redirect_uri", LINKEDIN_REDIRECT_URI);

  return c.redirect(authUrl.toString(), 302);
});

app.get("/auth/linkedin/callback", (c) => c.text("REDIRECTED!"));

Deno.serve(app.fetch);
