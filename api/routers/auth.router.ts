import { Hono } from "hono";
import AuthController from "../controllers/auth.controller.ts";
import jwt from "../middlewares/jwt.middleware.ts";

const AuthRouter = new Hono();

AuthRouter.get("/loginWithLinkedIn", AuthController.loginWithLinkedIn);
AuthRouter.get("/startUserSession", AuthController.startUserSession);
AuthRouter.get("/user", jwt, AuthController.getUser);

export default AuthRouter;
