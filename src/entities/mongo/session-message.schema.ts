import { Schema, model } from "mongoose";

export interface ISessionMessage {
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  from_id?: string;
  from_name?: string;
  embedding?: number[];
  created_at: Date;
}

const SessionMessageSchema = new Schema<ISessionMessage>(
  {
    session_id: { type: String, required: true, index: true },
    role: { type: String, enum: ["user", "assistant", "system"], required: true },
    content: { type: String, required: true },
    from_id: { type: String },
    from_name: { type: String },
    embedding: { type: [Number], default: undefined },
    created_at: { type: Date, default: () => new Date() },
  },
  {
    collection: "session_messages",
    versionKey: false,
  },
);

export const SessionMessageModel = model<ISessionMessage>("SessionMessage", SessionMessageSchema);
