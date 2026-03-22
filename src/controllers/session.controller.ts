import type { Context } from "hono";
import { Controller, Get, Middleware, Put } from "hono-decorators";
import { responseHelper } from "../libs/response-helper";
import JwtMiddleware from "../middleware/jwt-middleware";
import { getAccountId } from "../libs/utils";
import SessionService from "../services/session.service";
import ClientRepository from "../repositories/client.repository";
import AiModelRepository from "../repositories/ai-model.repository";
import { NotFoundException, BadRequestException } from "../libs/exception";

@Controller("session")
@Middleware([JwtMiddleware])
export class SessionController {
  private sessionService = new SessionService();
  private clientRepository = new ClientRepository();
  private aiModelRepository = new AiModelRepository();

  /** GET /session/client/:clientId — list sessions under a client */
  @Get("client/:clientId")
  async getByClient(c: Context) {
    const clientId = c.req.param("clientId");
    const accountId = getAccountId(c);

    const client = await this.clientRepository.findByIdAndAccountId(clientId, accountId);
    if (!client) throw new NotFoundException("Client not found");

    const sessions = await this.sessionService.getSessionsByClientId(clientId);
    return c.json(responseHelper.data(sessions));
  }

  /** GET /session/:id — session detail */
  @Get(":id")
  async getDetail(c: Context) {
    const sessionId = c.req.param("id");
    const accountId = getAccountId(c);

    const session = await this.sessionService.getSessionById(sessionId, accountId);
    return c.json(responseHelper.data(session));
  }

  /** GET /session/:id/messages — chat history from MongoDB */
  @Get(":id/messages")
  async getMessages(c: Context) {
    const sessionId = c.req.param("id");
    const accountId = getAccountId(c);
    const limit = Number(c.req.query("limit") ?? "100");

    // verify ownership
    await this.sessionService.getSessionById(sessionId, accountId);

    const messages = await this.sessionService.getHistory(sessionId, limit);
    return c.json(responseHelper.data(messages));
  }

  /** PUT /session/:id/model — assign or clear AI model for a session */
  @Put(":id/model")
  async setModel(c: Context) {
    const sessionId = c.req.param("id");
    const accountId = getAccountId(c);
    const { ai_model_id } = await c.req.json<{ ai_model_id: string | null }>();

    // verify ownership
    await this.sessionService.getSessionById(sessionId, accountId);

    if (ai_model_id) {
      const model = await this.aiModelRepository.findByIdAndAccountId(ai_model_id, accountId);
      if (!model) throw new BadRequestException("AI model not found");
    }

    await this.sessionService.setSessionModel(sessionId, ai_model_id ?? null, accountId);
    return c.json(responseHelper.success("Session model updated"));
  }
}
