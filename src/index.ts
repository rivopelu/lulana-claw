import "reflect-metadata";
import {Hono} from "hono";
import {env} from "./configs/env";
import logger from "./configs/logger";
import {ErrorHandler} from "./libs/error-handler";
import InitMiddlewares from "./middleware/init-middleware";

const app = new Hono();
const port = env.PORT || 8080;
app.onError(ErrorHandler);

app.get("/panic", () => {
  throw new Error("Test Error");
});
new InitMiddlewares(app);

app.get("/", (c) => {
  return c.json({message: "welcome"});
});

async function bootstrap() {
  try {
    const server = Bun.serve({
      fetch: app.fetch,
      port: port,
    });

    process.stdout.write("\u001b[2J\u001b[0;0H");

    logger.info("🌍 I18n initialized successfully");
    logger.info(`🔥 API initialized on ${server.url}`);
  } catch (error: any) {
    logger.error(`❌ Gagal: ${error.message}`);
    process.exit(1);
  }
}

bootstrap().then();

export {app};
