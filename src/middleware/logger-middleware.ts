import type { Context, Next } from "hono";
import logger from "../configs/logger";

const loggerMiddleware = async (c: Context, next: Next) => {
  const start = Date.now();
  let status = 0;

  try {
    await next();
    status = c.res?.status ?? 200;
  } catch (err: any) {
    status = err?.status ?? err?.statusCode ?? 500;
    throw err;
  } finally {
    const duration = Date.now() - start;
    logger.info(`[${c.req.method}] ${c.req.url} - Status: ${status} - ${duration}ms`);
  }
};

export default loggerMiddleware;
