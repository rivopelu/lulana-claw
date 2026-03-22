import {Hono} from "hono";
import {AuthController} from "../controllers/auth.controller";

const authRoutes = new Hono();
const authController = new AuthController();

authRoutes.get("/", authController.createAccount.bind(authController));

export default authRoutes;
