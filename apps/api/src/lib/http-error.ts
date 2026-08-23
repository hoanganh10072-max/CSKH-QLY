export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code = "HTTP_ERROR"
  ) {
    super(message);
  }
}

const resourceLabels: Record<string, string> = {
  Customer: "khách hàng",
  Task: "công việc",
  User: "người dùng",
  Resource: "dữ liệu"
};

export const notFound = (resource = "Resource") =>
  new HttpError(404, `Không tìm thấy ${resourceLabels[resource] || resource}`, "NOT_FOUND");
