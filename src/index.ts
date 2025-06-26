import { Hono } from "hono";
import { corsMiddleware } from "./middlewares/cors.middleware";
import { supabaseMiddleware } from "./middlewares/supabase.middleware";
import auth from "./routes/auth.route";

type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  PRODUCTION: string;
  LINKEDIN_REDIRECT_URI: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS configuration
app.use("*", corsMiddleware);

// Supabase middleware
app.use("*", supabaseMiddleware);

// Routes
app.route("/auth", auth);

export default app;
