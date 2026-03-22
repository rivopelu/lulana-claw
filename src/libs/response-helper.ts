import type { BaseResponse } from "../types/response/base-response";

export class responseHelper {
  static success(message?: string): BaseResponse<null> {
    return { success: true, message: message || "ok" };
  }

  static data<T>(data: T, message: string = "success"): BaseResponse<T> {
    return { success: true, message, response_data: data };
  }

  static paginated<T>(
    data: T,
    paginatedData: {
      page: number;
      size: number;
      totalData: number;
    },
  ): BaseResponse<T> {
    return {
      success: true,
      message: "success",
      response_data: data,
      paginated_data: {
        page: paginatedData.page,
        size: paginatedData.size,
        total_data: paginatedData.totalData,
        page_count: Math.ceil(paginatedData.totalData / paginatedData.size),
      },
    };
  }

  static error(message: string, _status: number): BaseResponse<null> {
    return { success: false, message };
  }
}
