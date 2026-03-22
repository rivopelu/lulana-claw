export interface RequestCreateClientCredential {
  key: string;
  value: string;
}

export interface RequestCreateClient {
  name: string;
  type: "telegram" | "discord" | "whatsapp" | "http";
  credentials: RequestCreateClientCredential[];
}
