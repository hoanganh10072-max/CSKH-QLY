import { ConsultationCallStatus, CustomerStatus, MessageStatus } from "@prisma/client";
import { z } from "zod";

export const customerIdParams = z.object({
  id: z.string().uuid()
});

export const listCustomersQuery = z.object({
  search: z.string().trim().optional(),
  status: z.nativeEnum(CustomerStatus).optional(),
  owner: z.enum(["all", "me", "unassigned", "assigned"]).default("all"),
  receivedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày nhận không hợp lệ").optional(),
  callState: z.enum(["all", "called", "not_called"]).default("all"),
  sortBy: z.enum(["createdAt", "updatedAt", "name", "status", "source", "city"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

export const updateCustomerSchema = z.object({
  name: z.string().trim().min(1).optional(),
  companyHead: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  source: z.string().trim().optional().nullable(),
  status: z.nativeEnum(CustomerStatus).optional(),
  revenue: z.coerce.number().min(0).optional()
});

const imageDataUrlSchema = z
  .string()
  .trim()
  .max(7_000_000, "Ảnh lịch sử cuộc gọi quá lớn")
  .regex(/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/, "Ảnh lịch sử cuộc gọi không hợp lệ");

export const addInteractionSchema = z
  .object({
    note: z.string().trim().min(1),
    result: z.string().trim().optional().nullable(),
    status: z.nativeEnum(CustomerStatus).optional(),
    callStatus: z.nativeEnum(ConsultationCallStatus).optional().nullable(),
    messageStatus: z.nativeEnum(MessageStatus).optional().nullable(),
    noMessageReason: z.string().trim().optional().nullable(),
    callHistoryImage: imageDataUrlSchema.optional().nullable()
  })
  .superRefine((value, context) => {
    if (value.callStatus === ConsultationCallStatus.NOT_REACHED && value.messageStatus) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["messageStatus"],
        message: "Không cập nhật trạng thái nhắn tin khi chưa gọi được"
      });
    }

    if (
      value.callStatus === ConsultationCallStatus.CALLED &&
      value.messageStatus === MessageStatus.NOT_SENT &&
      !value.noMessageReason
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["noMessageReason"],
        message: "Cần nhập lý do khi gọi được nhưng không nhắn tin"
      });
    }
  });
