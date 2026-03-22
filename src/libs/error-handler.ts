import type { Context } from "hono";
import { responseHelper } from "./response-helper";

export function ErrorHandler(err: any, c: Context) {
  c.status(err.status || 500);
  return c.json(responseHelper.error(err.message, err.status || 500));
}
