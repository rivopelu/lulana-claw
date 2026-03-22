import type { Context } from "hono";
import { Controller, Delete, Get, Middleware, Post, Put } from "hono-decorators";
import { responseHelper } from "../libs/response-helper";
import JwtMiddleware from "../middleware/jwt-middleware";
import { getAccountId } from "../libs/utils";
import TaskService from "../services/task.service";

@Controller("task")
@Middleware([JwtMiddleware])
export class TaskController {
  private taskService = new TaskService();

  @Get("")
  async getAll(c: Context) {
    const accountId = getAccountId(c);
    const status = c.req.query("status") as "pending" | "done" | "cancelled" | undefined;
    const tasks = await this.taskService.getAll(accountId, status);
    return c.json(responseHelper.data(tasks));
  }

  @Get(":id")
  async getById(c: Context) {
    const id = c.req.param("id");
    const accountId = getAccountId(c);
    const task = await this.taskService.getById(id, accountId);
    return c.json(responseHelper.data(task));
  }

  @Post("")
  async create(c: Context) {
    const accountId = getAccountId(c);
    const body = await c.req.json();
    const task = await this.taskService.create(body, accountId);
    return c.json(responseHelper.data(task), 201);
  }

  @Put(":id/done")
  async markDone(c: Context) {
    const id = c.req.param("id");
    const accountId = getAccountId(c);
    await this.taskService.markDone(id, accountId);
    return c.json(responseHelper.success("Task marked as done"));
  }

  @Put(":id/cancel")
  async cancel(c: Context) {
    const id = c.req.param("id");
    const accountId = getAccountId(c);
    await this.taskService.cancel(id, accountId);
    return c.json(responseHelper.success("Task cancelled"));
  }

  @Delete(":id")
  async delete(c: Context) {
    const id = c.req.param("id");
    const accountId = getAccountId(c);
    await this.taskService.delete(id, accountId);
    return c.json(responseHelper.success("Task deleted"));
  }
}
