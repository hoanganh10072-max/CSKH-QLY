import { randomUUID } from "crypto";
import { env } from "../config/env.js";
import { HttpError } from "./http-error.js";

const imageDataUrlPattern = /^data:(image\/(png|jpe?g|webp));base64,([A-Za-z0-9+/=]+)$/;

const extensionByMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

const encodeObjectPath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

const cleanSupabaseUrl = () => env.SUPABASE_URL?.replace(/\/+$/, "");

export const saveCallHistoryImage = async (
  dataUrl: string | null | undefined,
  context: { customerId: string; userId: string }
) => {
  if (!dataUrl) return null;

  if (!env.SUPABASE_STORAGE_ENABLED) {
    return dataUrl;
  }

  const supabaseUrl = cleanSupabaseUrl();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new HttpError(500, "Chưa cấu hình Supabase Storage", "SUPABASE_STORAGE_NOT_CONFIGURED");
  }

  const match = dataUrl.match(imageDataUrlPattern);
  if (!match) {
    throw new HttpError(422, "Ảnh lịch sử cuộc gọi không hợp lệ", "INVALID_CALL_HISTORY_IMAGE");
  }

  const [, mimeType, base64] = match;
  const extension = extensionByMimeType[mimeType];
  const imageBuffer = Buffer.from(base64, "base64");

  if (!extension || imageBuffer.length === 0) {
    throw new HttpError(422, "Ảnh lịch sử cuộc gọi không hợp lệ", "INVALID_CALL_HISTORY_IMAGE");
  }

  const objectPath = [
    "lich-su-cuoc-goi",
    context.customerId,
    `${Date.now()}-${context.userId}-${randomUUID()}.${extension}`
  ].join("/");
  const encodedBucket = encodeURIComponent(env.SUPABASE_CALL_IMAGES_BUCKET);
  const encodedObjectPath = encodeObjectPath(objectPath);
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${encodedBucket}/${encodedObjectPath}`;

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "cache-control": "3600",
      "content-type": mimeType,
      "x-upsert": "false"
    },
    body: imageBuffer
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new HttpError(
      502,
      `Không tải được ảnh minh chứng lên Supabase Storage: ${detail.slice(0, 240)}`,
      "SUPABASE_STORAGE_UPLOAD_FAILED"
    );
  }

  return `${supabaseUrl}/storage/v1/object/public/${encodedBucket}/${encodedObjectPath}`;
};
