import { Hono } from "hono";
import { cors } from "./middlewares/cors.middleware.ts";
import Router from "./routers/index.ts";

const app = new Hono();

// CORS configuration
app.use("/api/*", cors());

// Router
app.route("/api/v1", Router);

Deno.serve(app.fetch);
