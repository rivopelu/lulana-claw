import { db } from "../database/database";
import {
  type ClientCredential,
  ClientCredentialEntity,
  type NewClientCredential,
} from "../entities/pg/client-credential.entity";
import { and, eq } from "drizzle-orm";

export default class ClientCredentialRepository {
  async findByClientId(clientId: string): Promise<ClientCredential[]> {
    return db
      .select()
      .from(ClientCredentialEntity)
      .where(
        and(
          eq(ClientCredentialEntity.client_id, clientId),
          eq(ClientCredentialEntity.active, true),
        ),
      );
  }

  async findById(id: string): Promise<ClientCredential | undefined> {
    const data = await db
      .select()
      .from(ClientCredentialEntity)
      .where(and(eq(ClientCredentialEntity.id, id), eq(ClientCredentialEntity.active, true)))
      .limit(1);

    return data[0];
  }

  async findByClientIdAndKey(clientId: string, key: string): Promise<ClientCredential | undefined> {
    const data = await db
      .select()
      .from(ClientCredentialEntity)
      .where(
        and(
          eq(ClientCredentialEntity.client_id, clientId),
          eq(ClientCredentialEntity.key, key),
          eq(ClientCredentialEntity.active, true),
        ),
      )
      .limit(1);

    return data[0];
  }

  async save(credential: NewClientCredential): Promise<void> {
    await db.insert(ClientCredentialEntity).values(credential);
  }

  async update(id: string, data: Partial<NewClientCredential>): Promise<void> {
    await db.update(ClientCredentialEntity).set(data).where(eq(ClientCredentialEntity.id, id));
  }
}
