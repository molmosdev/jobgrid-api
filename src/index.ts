import { Hono } from "hono";
import { corsMiddleware } from "./middlewares/cors.middleware";
import { supabaseMiddleware } from "./middlewares/supabase.middleware";
import auth from "./routes/auth.route";
import companies from "./routes/companies.route";

type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
  AUTH0_DOMAIN: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_CLIENT_SECRET: string;
  PRODUCTION: string;
  COOKIE_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS configuration
app.use("*", corsMiddleware);

// Supabase middleware
app.use("*", supabaseMiddleware);

// Routes
app.route("/auth", auth);
app.route("/companies", companies);

export default app;
