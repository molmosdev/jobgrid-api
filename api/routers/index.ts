import { Hono } from "hono";
import AuthRouter from "./auth.router.ts";

const Router = new Hono();

Router.route("/auth", AuthRouter);

export default Router;
