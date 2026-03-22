import {Hono} from "hono";
import {registerControllers} from "hono-decorators";
import {PingController} from "../controllers/ping.controller";
import {AuthController} from "../controllers/auth.controller";

const appRoutes = new Hono();

const controllers = [PingController, AuthController];

registerControllers(controllers, appRoutes);

export default appRoutes;
