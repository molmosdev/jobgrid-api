import { Hono } from "hono";
import AuthController from "../controllers/auth.controller.ts";
import jwt from "../middlewares/jwt.middleware.ts";

const AuthRouter = new Hono();

AuthRouter.post("/login", AuthController.loginWithEmailAndPassword);
AuthRouter.get("/linkedin/login", AuthController.logInWithLinkedIn);
AuthRouter.get("/linkedin/callback", AuthController.linkedInCallback);
AuthRouter.get("/user", jwt, AuthController.getUser);
AuthRouter.get("/logout", AuthController.logout);
AuthRouter.post("/register", AuthController.register);

export default AuthRouter;
