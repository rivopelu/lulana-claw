export interface IPaginationParams {
  page: number;
  size: number;
  q?: string;
}

export interface IPaginationQuery<T> {
  page: number;
  size: number;
  total_data: number;
  data: T[];
}
