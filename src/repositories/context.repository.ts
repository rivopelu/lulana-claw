import {
  ContextModel,
  type IContext,
  type ContextType,
  type ContextCategory,
} from "../entities/mongo/context.schema";

export interface CreateContextInput {
  context_id: string;
  account_id: string;
  name: string;
  type: ContextType;
  category: ContextCategory;
  content: string;
  client_id?: string;
  session_id?: string;
  order?: number;
}

export default class ContextRepository {
  async create(input: CreateContextInput): Promise<IContext> {
    const doc = new ContextModel({
      ...input,
      order: input.order ?? 0,
      active: true,
      created_at: new Date(),
    });
    return doc.save();
  }

  async findById(contextId: string): Promise<IContext | null> {
    return ContextModel.findOne({ context_id: contextId, active: true });
  }

  async findByIdAndAccountId(contextId: string, accountId: string): Promise<IContext | null> {
    return ContextModel.findOne({ context_id: contextId, account_id: accountId, active: true });
  }

  async findAllByAccountId(accountId: string): Promise<IContext[]> {
    return ContextModel.find({ account_id: accountId, active: true }).sort({
      order: 1,
      created_at: 1,
    });
  }

  async findGlobal(accountId: string): Promise<IContext[]> {
    return ContextModel.find({ account_id: accountId, type: "global", active: true }).sort({
      order: 1,
    });
  }

  async findByClientId(clientId: string): Promise<IContext[]> {
    return ContextModel.find({ client_id: clientId, type: "client", active: true }).sort({
      order: 1,
    });
  }

  async findBySessionId(sessionId: string): Promise<IContext[]> {
    return ContextModel.find({ session_id: sessionId, type: "session", active: true }).sort({
      order: 1,
    });
  }

  async findAllActiveForSync(): Promise<IContext[]> {
    return ContextModel.find({ active: true }).sort({ type: 1, order: 1 });
  }

  async update(contextId: string, data: Partial<IContext>): Promise<void> {
    await ContextModel.updateOne({ context_id: contextId }, { ...data, updated_at: new Date() });
  }

  async softDelete(contextId: string): Promise<void> {
    await ContextModel.updateOne(
      { context_id: contextId },
      { active: false, updated_at: new Date() },
    );
  }

  /** Find the auto-generated context for a session (tagged with name prefix "auto:") */
  async findAutoBySessionId(sessionId: string): Promise<IContext | null> {
    return ContextModel.findOne({
      session_id: sessionId,
      type: "session",
      category: "custom",
      name: /^auto:/,
      active: true,
    });
  }
}
