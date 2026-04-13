import TaskRepository from "../repositories/task.repository";
import type { Task } from "../entities/pg/task.entity";
import { NotFoundException } from "../libs/exception";
import { generateId } from "../libs/string-utils";

export type TaskType = "task" | "reminder" | "notes" | "meeting" | "deadline";

export interface RequestCreateTask {
  client_id: string;
  chat_id: number;
  session_id?: string;
  type?: TaskType;
  title: string;
  description?: string;
  remind_at?: number;
}

export interface ResponseTask {
  id: string;
  client_id: string;
  chat_id: number;
  session_id?: string | null;
  type: TaskType;
  title: string;
  description?: string | null;
  remind_at?: number | null;
  reminded: boolean;
  status: "pending" | "done" | "cancelled";
  created_date: number;
}

function toResponse(t: Task): ResponseTask {
  return {
    id: t.id,
    client_id: t.client_id,
    chat_id: t.chat_id,
    session_id: t.session_id,
    type: t.type as TaskType,
    title: t.title,
    description: t.description,
    remind_at: t.remind_at,
    reminded: t.reminded,
    status: t.status,
    created_date: t.created_date,
  };
}

/**
 * Parse a human-friendly time string into a Unix ms timestamp.
 * Formats: 30m | 2h | 1d | HH:MM | DD/MM HH:MM | DD/MM/YYYY HH:MM
 */
export function parseRemindTime(input: string): number | null {
  const now = Date.now();
  const s = input.trim();

  // Relative: 30m / 2h / 1d
  const rel = s.match(/^(\d+)(m|h|d)$/i);
  if (rel) {
    const n = parseInt(rel[1]);
    const unit = rel[2].toLowerCase();
    const ms = unit === "m" ? n * 60_000 : unit === "h" ? n * 3_600_000 : n * 86_400_000;
    return now + ms;
  }

  // Time only: HH:MM — today, or tomorrow if already passed
  const timeOnly = s.match(/^(\d{1,2}):(\d{2})$/);
  if (timeOnly) {
    const d = new Date();
    d.setHours(parseInt(timeOnly[1]), parseInt(timeOnly[2]), 0, 0);
    if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    return d.getTime();
  }

  // DD/MM HH:MM or DD/MM/YYYY HH:MM
  const full = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s+(\d{1,2}):(\d{2})$/);
  if (full) {
    const year = full[3] ? parseInt(full[3]) : new Date().getFullYear();
    const d = new Date(
      year,
      parseInt(full[2]) - 1,
      parseInt(full[1]),
      parseInt(full[4]),
      parseInt(full[5]),
      0,
      0,
    );
    return d.getTime();
  }

  return null;
}

export default class TaskService {
  private repository = new TaskRepository();

  async create(body: RequestCreateTask, accountId: string): Promise<ResponseTask> {
    const id = generateId();
    await this.repository.save({
      id,
      account_id: accountId,
      client_id: body.client_id,
      chat_id: body.chat_id,
      session_id: body.session_id,
      type: body.type ?? "task",
      title: body.title,
      description: body.description,
      remind_at: body.remind_at ?? null,
      reminded: false,
      status: "pending",
      created_by: accountId,
    });
    const task = await this.repository.findById(id);
    return toResponse(task!);
  }

  async getAll(accountId: string, status?: Task["status"]): Promise<ResponseTask[]> {
    const list = await this.repository.findAllByAccountId(accountId, status);
    return list.map(toResponse);
  }

  async getById(id: string, accountId: string): Promise<ResponseTask> {
    const task = await this.repository.findByIdAndAccountId(id, accountId);
    if (!task) throw new NotFoundException("Task not found");
    return toResponse(task);
  }

  async getByChatId(
    clientId: string,
    chatId: number,
    status?: Task["status"],
  ): Promise<ResponseTask[]> {
    const list = await this.repository.findByChatId(clientId, chatId, status);
    return list.map(toResponse);
  }

  async markDone(id: string, accountId: string): Promise<void> {
    const task = await this.repository.findByIdAndAccountId(id, accountId);
    if (!task) throw new NotFoundException("Task not found");
    await this.repository.update(id, {
      status: "done",
      updated_by: accountId,
      updated_date: Date.now(),
    });
  }

  async cancel(id: string, accountId: string): Promise<void> {
    const task = await this.repository.findByIdAndAccountId(id, accountId);
    if (!task) throw new NotFoundException("Task not found");
    await this.repository.update(id, {
      status: "cancelled",
      updated_by: accountId,
      updated_date: Date.now(),
    });
  }

  async delete(id: string, accountId: string): Promise<void> {
    const task = await this.repository.findByIdAndAccountId(id, accountId);
    if (!task) throw new NotFoundException("Task not found");
    await this.repository.update(id, {
      active: false,
      deleted_by: accountId,
      deleted_date: Date.now(),
    });
  }
}
