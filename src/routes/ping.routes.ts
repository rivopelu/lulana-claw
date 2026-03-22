import {Hono} from "hono";
import {PingController} from "../controllers/ping.controller";

const pingRoutes = new Hono();
const pingController = new PingController();

pingRoutes.get("/", pingController.ping.bind(pingController));

export default pingRoutes;
