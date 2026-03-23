import type { Context } from "hono";
import { responseHelper } from "./response-helper";
import logger from "../configs/logger";

export function ErrorHandler(err: any, c: Context) {
  const status = err.status ?? err.statusCode ?? 500;
  c.status(status);
  if (status >= 500) {
    logger.error(`[Error ${status}] ${err.message}`, err);
  } else {
    logger.warn(`[Error ${status}] ${c.req.method} ${c.req.path} — ${err.message}`);
  }
  return c.json(responseHelper.error(err.message, status));
}
