import { Hono } from "hono";

const app = new Hono();

const LINKEDIN_CLIENT_ID = Deno.env.get("LINKEDIN_CLIENT_ID")!;
const LINKEDIN_REDIRECT_URI = Deno.env.get("LINKEDIN_REDIRECT_URI")!;

app.get("/", (c) => c.text("Hello, World!"));

app.get("/auth/linkedin", (c) => {
  const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("client_id", LINKEDIN_CLIENT_ID);
  authUrl.searchParams.append("scope", "openid profile email");
  authUrl.searchParams.append(
    "state",
    Math.random().toString(36).substring(2, 15)
  );
  authUrl.searchParams.append("redirect_uri", LINKEDIN_REDIRECT_URI);

  return c.redirect(authUrl.toString(), 302);
});

app.get("/auth/linkedin/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state"); // You might want to verify this

  if (!code) {
    return c.text("Error: No code received from LinkedIn.", 400);
  }

  const LINKEDIN_CLIENT_SECRET = Deno.env.get("LINKEDIN_CLIENT_SECRET")!; // Make sure you have this in your environment variables

  const tokenEndpoint = "https://www.linkedin.com/oauth/v2/accessToken";
  const params = new URLSearchParams();
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("client_id", LINKEDIN_CLIENT_ID);
  params.append("client_secret", LINKEDIN_CLIENT_SECRET);
  params.append("redirect_uri", LINKEDIN_REDIRECT_URI);

  try {
    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (response.ok) {
      // You now have the access token in data.access_token
      console.log("Access Token:", data.access_token);
      // You can now store this token securely and use it to fetch user data
      return c.json(data); // Or redirect to another page with the token
    } else {
      console.error("Error exchanging code for token:", data);
      return c.text(
        `Error: Could not retrieve access token. ${
          data.error_description || data.error
        }`,
        500
      );
    }
  } catch (error) {
    console.error("Error during token exchange:", error);
    return c.text(
      "Error: Could not communicate with LinkedIn's token endpoint.",
      500
    );
  }
});

Deno.serve(app.fetch);
