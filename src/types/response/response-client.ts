export interface ResponseClientCredential {
  id: string;
  key: string;
  value: string;
}

export interface ResponseClient {
  id: string;
  name: string;
  type: string;
  credentials: ResponseClientCredential[];
  active: boolean;
  created_date: number;
}

export interface ResponseClientSummary {
  id: string;
  name: string;
  type: string;
  active: boolean;
  created_date: number;
}
