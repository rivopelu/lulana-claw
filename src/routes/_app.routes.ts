import { Hono } from "hono";
import { registerControllers } from "hono-decorators";
import { PingController } from "../controllers/ping.controller";
import { AuthController } from "../controllers/auth.controller";
import { MasterController } from "../controllers/master.controller";
import { ClientController } from "../controllers/client.controller";
import { BotController } from "../controllers/bot.controller";
import { AiModelController } from "../controllers/ai-model.controller";
import { SessionController } from "../controllers/session.controller";
import { ContextController } from "../controllers/context.controller";
import { TaskController } from "../controllers/task.controller";
import { AppController } from "../controllers/app.controller";
import { ContentController } from "../controllers/content.controller";
import { MediaController } from "../controllers/media.controller";
import { FinanceController } from "../controllers/finance.controller";
import { ThreadsWebhookController } from "../controllers/threads-webhook.controller";

const appRoutes = new Hono();

const controllers = [
  PingController,
  ThreadsWebhookController,
  AuthController,
  MasterController,
  ClientController,
  BotController,
  AiModelController,
  SessionController,
  ContextController,
  TaskController,
  AppController,
  ContentController,
  MediaController,
  FinanceController,
];

registerControllers(controllers, appRoutes);

export default appRoutes;
