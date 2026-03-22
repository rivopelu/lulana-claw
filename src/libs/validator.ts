import {zValidator} from "@hono/zod-validator";
import type {MiddlewareHandler} from "hono";
import type {ZodSchema} from "zod";
import {responseHelper} from "./response-helper";

export const validate = (schema: ZodSchema): MiddlewareHandler => {
  return zValidator("json", schema, (result, c) => {
    if (!result.success && "error" in result) {
      const firstError = result.error.issues[0];
      const errorKey = firstError?.message || "validation.failed";
      return c.json(responseHelper.error(errorKey, 400));
    }
  }) as unknown as MiddlewareHandler;
};
