import {
  SessionMessageModel,
  type ISessionMessage,
} from "../entities/mongo/session-message.schema";

export default class SessionMessageRepository {
  async findBySessionId(sessionId: string, limit = 50): Promise<ISessionMessage[]> {
    return SessionMessageModel.find({ session_id: sessionId })
      .sort({ created_at: 1 })
      .limit(limit)
      .lean();
  }

  async create(message: Omit<ISessionMessage, "created_at">): Promise<void> {
    await SessionMessageModel.create(message);
  }

  async countBySessionId(sessionId: string): Promise<number> {
    return SessionMessageModel.countDocuments({ session_id: sessionId });
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    await SessionMessageModel.deleteMany({ session_id: sessionId });
  }
}
