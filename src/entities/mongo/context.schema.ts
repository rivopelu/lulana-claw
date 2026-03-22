import { Schema, model } from "mongoose";

export type ContextType = "global" | "client" | "session";
export type ContextCategory = "identity" | "personality" | "rules" | "knowledge" | "custom";

export interface IContext {
  context_id: string;
  account_id: string;
  name: string;
  type: ContextType;
  category: ContextCategory;
  content: string;
  client_id?: string;
  session_id?: string;
  order: number;
  active: boolean;
  embedding?: number[];
  created_at: Date;
  updated_at?: Date;
}

const ContextSchema = new Schema<IContext>(
  {
    context_id: { type: String, required: true, unique: true, index: true },
    account_id: { type: String, required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, enum: ["global", "client", "session"], required: true },
    category: {
      type: String,
      enum: ["identity", "personality", "rules", "knowledge", "custom"],
      required: true,
    },
    content: { type: String, required: true },
    client_id: { type: String, index: true },
    session_id: { type: String, index: true },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    embedding: { type: [Number], default: undefined },
    created_at: { type: Date, default: () => new Date() },
    updated_at: { type: Date },
  },
  {
    collection: "contexts",
    versionKey: false,
  },
);

export const ContextModel = model<IContext>("Context", ContextSchema);
