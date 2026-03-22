import type { Context } from "hono";
import type { IPaginationParams } from "../types/paginated-params";

export function getAccountId(c: Context): string {
  return c.get("accountId");
}

export function getPaginationParam(c: Context): IPaginationParams {
  const page = c.req.query("page");
  const size = c.req.query("size");
  const query = c.req.query("q");
  return {
    page: page ? Number(page) : 0,
    size: size ? Number(size) : 10,
    q: query || undefined,
  };
}
