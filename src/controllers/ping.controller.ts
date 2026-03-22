import type {Context} from "hono";
import {Controller, Get} from "hono-decorators";
import {responseHelper} from "../libs/response-helper";

@Controller('ping')
export class PingController {
  @Get('/')
  ping(c: Context) {
    return c.json(responseHelper.data({message: "pong"}));
  }
}
