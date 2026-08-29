"use client";

import type { SessionUser } from "./types";

const PRODUCTION_HOSTS = new Set(["trungtamgiasuskv.cloud", "www.trungtamgiasuskv.cloud"]);
const PRODUCTION_API_URL = "https://api.trungtamgiasuskv.cloud";
const CONFIGURED_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const getApiBaseUrl = () => {
  if (typeof window !== "undefined" && PRODUCTION_HOSTS.has(window.location.hostname)) {
    return PRODUCTION_API_URL;
  }

  return CONFIGURED_API_URL;
};

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const ensureHttpsOnProduction = () => {
  if (typeof window === "undefined") return;
  if (window.location.protocol === "https:") return;
  if (!PRODUCTION_HOSTS.has(window.location.hostname)) return;

  const nextUrl = new URL(window.location.href);
  nextUrl.protocol = "https:";
  window.location.replace(nextUrl.toString());
};
const TOKEN_KEY = "cskh_token";
const USER_KEY = "cskh_user";

export class ApiError extends Error {
  public readonly issues?: unknown;
  public readonly raw?: unknown;

  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    options: { issues?: unknown; raw?: unknown } = {}
  ) {
    super(message);
    this.issues = options.issues;
    this.raw = options.raw;
  }
}

type ApiOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | null;
  json?: unknown;
};

export const getToken = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
};

export const getStoredUser = (): SessionUser | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as SessionUser) : null;
};

export const setSession = (token: string, user: SessionUser) => {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event("cskh-session-changed"));
};

export const clearSession = () => {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event("cskh-session-changed"));
};

export const apiFetch = async <T>(path: string, options: ApiOptions = {}) => {
  ensureHttpsOnProduction();
  const apiUrl = getApiBaseUrl();
  const { json, headers: inputHeaders, ...init } = options;
  const headers = new Headers(inputHeaders);
  const token = getToken();
  let body = init.body;

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(json);
  }

  let response: Response | null = null;
  let networkError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await fetch(`${apiUrl}${path}`, {
        ...init,
        body,
        headers,
        cache: "no-store"
      });
      break;
    } catch (caught) {
      networkError = caught;
      if (attempt < 2) await sleep(500 * (attempt + 1));
    }
  }

  if (!response) {
    const reason = networkError instanceof Error ? networkError.message : String(networkError);
    throw new ApiError(`Không kết nối được API ${apiUrl}${path}. Chi tiết: ${reason}`, 0, "NETWORK_ERROR", {
      raw: networkError
    });
  }

  const rawText = await response.text();
  const contentType = response.headers.get("content-type") || "";
  let payload: unknown = rawText;

  if (rawText && contentType.includes("application/json")) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = rawText;
    }
  } else if (!rawText) {
    payload = null;
  }

  if (!response.ok) {
    const apiPayload = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
    const message = typeof apiPayload?.message === "string" ? apiPayload.message : rawText || "Yêu cầu thất bại";
    const code = typeof apiPayload?.code === "string" ? apiPayload.code : "HTTP_ERROR";
    throw new ApiError(message, response.status, code, {
      issues: apiPayload?.issues,
      raw: payload
    });
  }

  return payload as T;
};

const fieldLabels: Record<string, string> = {
  name: "họ tên",
  companyHead: "người đứng đầu công ty",
  username: "tên đăng nhập",
  phone: "số điện thoại",
  bankAccountNumber: "số tài khoản",
  bankName: "tên ngân hàng",
  bankAccountHolder: "tên chủ tài khoản",
  email: "thư điện tử",
  password: "mật khẩu",
  address: "địa chỉ",
  city: "thành phố",
  importName: "tên lô dữ liệu",
  source: "nguồn",
  sourceUrl: "link dữ liệu",
  status: "trạng thái",
  revenue: "doanh thu",
  receivedDate: "ngày nhận",
  customerId: "khách hàng",
  userId: "người phụ trách",
  title: "tiêu đề",
  deadline: "hạn xử lý",
  note: "ghi chú",
  result: "kết quả",
  callStatus: "tình trạng cuộc gọi",
  callState: "tình trạng gọi",
  messageStatus: "trạng thái nhắn tin",
  noMessageReason: "lý do chưa nhắn tin",
  callHistoryImage: "ảnh lịch sử cuộc gọi",
  account: "tài khoản",
  weekStart: "tuần làm việc",
  monday: "thứ hai",
  tuesday: "thứ ba",
  wednesday: "thứ tư",
  thursday: "thứ năm",
  friday: "thứ sáu",
  saturday: "thứ bảy",
  sunday: "chủ nhật",
  start: "giờ bắt đầu",
  end: "giờ kết thúc"
};

const errorCodeLabels: Record<string, string> = {
  NETWORK_ERROR: "Lỗi kết nối",
  HTTP_ERROR: "Lỗi yêu cầu",
  VALIDATION_ERROR: "Dữ liệu không hợp lệ",
  UNAUTHORIZED: "Chưa đăng nhập",
  FORBIDDEN: "Không đủ quyền",
  NOT_FOUND: "Không tìm thấy dữ liệu",
  DUPLICATE: "Dữ liệu trùng lặp",
  INTERNAL_SERVER_ERROR: "Lỗi máy chủ",
  INVALID_CREDENTIALS: "Sai thông tin đăng nhập",
  USER_INACTIVE: "Tài khoản bị khóa",
  INVALID_FILE_TYPE: "Sai loại tệp",
  FILE_REQUIRED: "Thiếu tệp dữ liệu",
  FILE_TOO_LARGE: "Tệp quá lớn",
  INVALID_DRIVE_LINK: "Link dữ liệu không hợp lệ",
  CUSTOMER_NOT_ASSIGNED: "Khách hàng chưa được giao",
  CUSTOMER_NOT_VISIBLE: "Không được xem khách hàng",
  STAFF_STATUS_ONLY: "Trạng thái không hợp lệ với nhân viên",
  STAFF_ONLY_CLAIM: "Chỉ nhân viên được nhận dữ liệu",
  CUSTOMER_ALREADY_CLAIMED: "Khách hàng đã có người chăm sóc",
  ADMIN_ONLY_RELEASE: "Chỉ quản trị viên được trả dữ liệu",
  TASK_USER_REQUIRED: "Công việc thiếu người phụ trách",
  TASK_NOT_ASSIGNED: "Công việc không thuộc quyền xử lý"
};

const translateIssueMessage = (message: string) => {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid email")) return "Thư điện tử không hợp lệ";
  if (normalized.includes("required")) return "Trường này là bắt buộc";
  if (normalized.includes("invalid uuid")) return "Mã dữ liệu không hợp lệ";
  if (normalized.includes("invalid date")) return "Ngày giờ không hợp lệ";
  if (normalized.includes("too small") || normalized.includes("at least")) return "Giá trị quá ngắn";
  if (normalized.includes("too big") || normalized.includes("at most")) return "Giá trị quá dài";
  if (normalized.includes("invalid enum")) return "Giá trị lựa chọn không hợp lệ";

  return message;
};

const formatPath = (path: string[]) =>
  path.map((item) => fieldLabels[item] || item).join(".");

const formatIssues = (issues: unknown) => {
  if (!Array.isArray(issues) || !issues.length) return "";

  return issues
    .map((issue, index) => {
      if (!issue || typeof issue !== "object") return `${index + 1}. ${String(issue)}`;
      const item = issue as Record<string, unknown>;
      const path = Array.isArray(item.path) ? formatPath(item.path.map(String)) : "";
      const message = typeof item.message === "string" ? translateIssueMessage(item.message) : JSON.stringify(item);
      return `${index + 1}. ${path ? `${path}: ` : ""}${message}`;
    })
    .join("\n");
};

export const describeError = (caught: unknown, fallback: string) => {
  if (caught instanceof ApiError) {
    const meta = [
      caught.status ? `HTTP ${caught.status}` : null,
      caught.code ? `Loại lỗi: ${errorCodeLabels[caught.code] || "Lỗi không xác định"}` : null
    ].filter(Boolean);
    const issues = formatIssues(caught.issues);
    return [caught.message, meta.length ? meta.join(" | ") : null, issues ? `Dữ liệu không hợp lệ:\n${issues}` : null]
      .filter(Boolean)
      .join("\n");
  }

  if (caught instanceof Error) {
    return `${fallback}\n${caught.name}: ${caught.message}`;
  }

  return `${fallback}\n${String(caught)}`;
};



