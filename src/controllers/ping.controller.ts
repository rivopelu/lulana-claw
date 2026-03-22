import type {Context} from "hono";

export class PingController {
  ping(c: Context) {
    return c.json({message: "pong"});
  }
}
