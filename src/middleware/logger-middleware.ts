import type { Context, Next } from "hono";
import logger from "../configs/logger";

const loggerMiddleware = async (c: Context, next: Next) => {
  const start = Date.now();

  try {
    await next();
  } catch (err) {
    throw err;
  } finally {
    const duration = Date.now() - start;
    const method = c.req.method;
    const url = c.req.url;
    const status = c.res.status;
    logger.info(`[${method}] ${url} - Status: ${status} - ${duration}ms`);
  }
};

export default loggerMiddleware;
