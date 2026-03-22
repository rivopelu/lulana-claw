import { Hono } from "hono";
import { registerControllers } from "hono-decorators";
import { PingController } from "../controllers/ping.controller";
import { AuthController } from "../controllers/auth.controller";
import { MasterController } from "../controllers/master.controller";
import { ClientController } from "../controllers/client.controller";
import { BotController } from "../controllers/bot.controller";
import { AiModelController } from "../controllers/ai-model.controller";

const appRoutes = new Hono();

const controllers = [
  PingController,
  AuthController,
  MasterController,
  ClientController,
  BotController,
  AiModelController,
];

registerControllers(controllers, appRoutes);

export default appRoutes;
