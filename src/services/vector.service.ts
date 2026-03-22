import { ContextModel, type IContext } from "../entities/mongo/context.schema";
import {
  SessionMessageModel,
  type ISessionMessage,
} from "../entities/mongo/session-message.schema";

export type VectorSearchCollection = "contexts" | "session_messages";

export interface VectorSearchResult<T> {
  score: number;
  data: T;
}

export default class VectorService {
  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Search related contexts using MongoDB Atlas Vector Search
   * Fallback to local JS-based similarity if Atlas search is not available
   */
  async searchContexts(
    accountId: string,
    queryEmbedding: number[],
    options: {
      clientId?: string;
      sessionId?: string;
      limit?: number;
    } = {},
  ): Promise<IContext[]> {
    const { clientId, sessionId, limit = 5 } = options;

    const filter: any = { account_id: accountId, active: true };
    if (clientId) filter.client_id = clientId;
    if (sessionId) filter.session_id = sessionId;

    try {
      // 1. Try Atlas Vector Search FIRST
      const pipeline = [
        {
          $vectorSearch: {
            index: "vector_index",
            path: "embedding",
            queryVector: queryEmbedding,
            numCandidates: 100,
            limit: limit,
            filter: filter,
          },
        },
        {
          $project: {
            score: { $meta: "vectorSearchScore" },
            context_id: 1,
            name: 1,
            content: 1,
            type: 1,
            category: 1,
            order: 1,
          },
        },
      ];
      return await ContextModel.aggregate(pipeline).exec();
    } catch (err) {
      // 2. FALLBACK: Local similarity search
      console.warn(
        "Atlas Vector Search failed, falling back to local search:",
        (err as Error).message,
      );

      const all = await ContextModel.find({
        ...filter,
        embedding: { $exists: true, $ne: null },
      }).lean();

      console.info(`[VectorService] Local contexts fallback: scanning ${all.length} documents...`);

      const scored = all
        .map((doc) => ({
          ...(doc as any),
          score: doc.embedding ? this.cosineSimilarity(queryEmbedding, doc.embedding) : 0,
        }))
        .filter((doc) => doc.score > 0.5) // Lowered threshold to 0.5
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      if (scored.length > 0) {
        console.info(
          `[VectorService] Found ${scored.length} related contexts. Top score: ${scored[0].score.toFixed(4)}`,
        );
      }

      return scored as unknown as IContext[];
    }
  }

  /**
   * Search related chat history messages
   * Fallback to local JS-based similarity if Atlas search is not available
   */
  async searchHistory(
    sessionId: string,
    queryEmbedding: number[],
    limit = 5,
  ): Promise<ISessionMessage[]> {
    try {
      // 1. Try Atlas Vector Search FIRST
      const pipeline = [
        {
          $vectorSearch: {
            index: "vector_index",
            path: "embedding",
            queryVector: queryEmbedding,
            numCandidates: 100,
            limit: limit,
            filter: { session_id: sessionId },
          },
        },
        {
          $project: {
            role: 1,
            content: 1,
            from_name: 1,
            created_at: 1,
          },
        },
      ];
      return await SessionMessageModel.aggregate(pipeline).exec();
    } catch (err) {
      // 2. FALLBACK: Local similarity search on recent session history
      console.warn(
        "Atlas Vector Search on history failed, falling back to local:",
        (err as Error).message,
      );

      const recentMessages = await SessionMessageModel.find({
        session_id: sessionId,
        embedding: { $exists: true, $ne: null },
      })
        .sort({ created_at: -1 })
        .limit(200) // Increased window for local search
        .lean();

      console.info(
        `[VectorService] Local history fallback: scanning ${recentMessages.length} messages for session ${sessionId}...`,
      );

      const scored = recentMessages
        .map((msg) => ({
          ...(msg as any),
          score: msg.embedding ? this.cosineSimilarity(queryEmbedding, msg.embedding) : 0,
        }))
        .filter((msg) => msg.score > 0.5) // Lowered threshold to 0.5
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      if (scored.length > 0) {
        console.info(
          `[VectorService] Found ${scored.length} related messages. Top score: ${scored[0].score.toFixed(4)}`,
        );
      }

      return scored as unknown as ISessionMessage[];
    }
  }
}
