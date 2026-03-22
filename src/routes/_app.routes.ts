import { Hono } from "hono";
import { registerControllers } from "hono-decorators";
import { PingController } from "../controllers/ping.controller";
import { AuthController } from "../controllers/auth.controller";
import { MasterController } from "../controllers/master.controller";
import { ClientController } from "../controllers/client.controller";

const appRoutes = new Hono();

const controllers = [PingController, AuthController, MasterController, ClientController];

registerControllers(controllers, appRoutes);

export default appRoutes;
