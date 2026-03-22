import {Hono} from "hono";
import corsConfig from "../configs/cors.config";
import appRoutes from "../routes/_app.routes";
import loggerMiddleware from "./logger-middleware";

export default class InitMiddlewares {
  private app: Hono;

  constructor(app: Hono) {
    this.app = app;
    this.setupMiddlewares();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.app.route("/api", appRoutes);
  }

  private setupMiddlewares() {
    this.app.use("*", loggerMiddleware);
    this.app.use("*", corsConfig);
  }
}
