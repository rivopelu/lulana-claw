import {Hono} from "hono";
import pingRoutes from "./ping.routes";

const appRoutes = new Hono();

appRoutes.route("/ping", pingRoutes);

export default appRoutes;
