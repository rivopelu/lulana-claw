import { db } from "../database/database";
import {
  ContentDraftEntity,
  type ContentDraft,
  type NewContentDraft,
} from "../entities/pg/content-draft.entity";
import { and, eq, lte, or, count } from "drizzle-orm";

export default class ContentDraftRepository {
  async save(draft: NewContentDraft): Promise<void> {
    await db.insert(ContentDraftEntity).values(draft);
  }

  async findById(id: string): Promise<ContentDraft | undefined> {
    const data = await db
      .select()
      .from(ContentDraftEntity)
      .where(and(eq(ContentDraftEntity.id, id), eq(ContentDraftEntity.active, true)))
      .limit(1);
    return data[0];
  }

  async findByIdAndAccountId(id: string, accountId: string): Promise<ContentDraft | undefined> {
    const data = await db
      .select()
      .from(ContentDraftEntity)
      .where(
        and(
          eq(ContentDraftEntity.id, id),
          eq(ContentDraftEntity.account_id, accountId),
          eq(ContentDraftEntity.active, true),
        ),
      )
      .limit(1);
    return data[0];
  }

  async findAllByAccountId(
    accountId: string,
    status?: ContentDraft["status"],
  ): Promise<ContentDraft[]> {
    return db
      .select()
      .from(ContentDraftEntity)
      .where(
        and(
          eq(ContentDraftEntity.account_id, accountId),
          eq(ContentDraftEntity.active, true),
          status ? eq(ContentDraftEntity.status, status) : undefined,
        ),
      )
      .orderBy(ContentDraftEntity.created_date);
  }

  /** Find approved/partial_published drafts whose scheduled_at has passed */
  async findDuePublish(now: number): Promise<ContentDraft[]> {
    return db
      .select()
      .from(ContentDraftEntity)
      .where(
        and(
          eq(ContentDraftEntity.active, true),
          lte(ContentDraftEntity.scheduled_at, now),
          or(
            eq(ContentDraftEntity.status, "approved"),
            eq(ContentDraftEntity.status, "partial_published"),
          ),
        ),
      );
  }

  async update(id: string, data: Partial<NewContentDraft>): Promise<void> {
    await db.update(ContentDraftEntity).set(data).where(eq(ContentDraftEntity.id, id));
  }

  async countByAccountId(accountId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(ContentDraftEntity)
      .where(
        and(eq(ContentDraftEntity.account_id, accountId), eq(ContentDraftEntity.active, true)),
      );
    return result[0].count;
  }
}
