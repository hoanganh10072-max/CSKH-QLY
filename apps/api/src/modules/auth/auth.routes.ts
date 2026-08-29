import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { UserRole, UserStatus } from "@prisma/client";
import type { InternDailyReport, WeeklyWorkSchedule } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { HttpError } from "../../lib/http-error.js";
import { signAccessToken } from "../../lib/jwt.js";
import { verifyPassword } from "../../lib/password.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";

const loginSchema = z
  .object({
    account: z.string().trim().min(1).optional(),
    email: z.string().trim().min(1).optional(),
    password: z.string().min(1)
  })
  .refine((data) => data.account || data.email, {
    path: ["account"],
    message: "Cần nhập tài khoản"
  });

const loginAliases: Record<string, string> = {
  admin: "admin@mscilabs.local"
};

const optionalDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ")
  .optional()
  .nullable();

const updateMeSchema = z.object({
  name: z.string().trim().min(2),
  phone: z.string().trim().optional().nullable(),
  employeeCode: z.string().trim().max(50).optional().nullable(),
  department: z.string().trim().max(100).optional().nullable(),
  positionTitle: z.string().trim().max(100).optional().nullable(),
  dateOfBirth: optionalDateSchema,
  gender: z.string().trim().max(30).optional().nullable(),
  citizenId: z.string().trim().max(30).optional().nullable(),
  citizenIssuedDate: optionalDateSchema,
  citizenIssuedPlace: z.string().trim().max(150).optional().nullable(),
  currentAddress: z.string().trim().max(300).optional().nullable(),
  hometown: z.string().trim().max(200).optional().nullable(),
  emergencyContactName: z.string().trim().max(120).optional().nullable(),
  emergencyContactPhone: z.string().trim().max(30).optional().nullable(),
  startDate: optionalDateSchema,
  personalNote: z.string().trim().max(1000).optional().nullable(),
  bankAccountNumber: z.string().trim().max(50).optional().nullable(),
  bankName: z.string().trim().max(100).optional().nullable(),
  bankAccountHolder: z.string().trim().max(100).optional().nullable()
});

const weekStartRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const scheduleDaySchema = z
  .object({
    working: z.boolean(),
    start: z.string().optional().nullable(),
    end: z.string().optional().nullable()
  })
  .superRefine((day, context) => {
    if (day.start && !timeRegex.test(day.start)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["start"], message: "Giờ bắt đầu không hợp lệ" });
    }

    if (day.end && !timeRegex.test(day.end)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["end"], message: "Giờ kết thúc không hợp lệ" });
    }

    if (!day.working) return;

    if (!day.start) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["start"], message: "Cần nhập giờ bắt đầu" });
    }

    if (!day.end) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["end"], message: "Cần nhập giờ kết thúc" });
    }

    if (day.start && day.end && day.start >= day.end) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["end"], message: "Giờ kết thúc phải sau giờ bắt đầu" });
    }
  });

const scheduleDaysSchema = z.object({
  monday: scheduleDaySchema,
  tuesday: scheduleDaySchema,
  wednesday: scheduleDaySchema,
  thursday: scheduleDaySchema,
  friday: scheduleDaySchema,
  saturday: scheduleDaySchema,
  sunday: scheduleDaySchema
});

const scheduleQuerySchema = z.object({
  weekStart: z.string().regex(weekStartRegex, "Tuần làm việc không hợp lệ")
});

const weeklyScheduleSchema = z.object({
  weekStart: z.string().regex(weekStartRegex, "Tuần làm việc không hợp lệ"),
  note: z.string().trim().max(500).optional().nullable(),
  days: scheduleDaysSchema
});

const reportQuerySchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày báo cáo không hợp lệ")
});

const reportBodySchema = reportQuerySchema.extend({
  workSummary: z.string().trim().min(1, "Cần nhập công việc đã thực hiện").max(5000),
  result: z.string().trim().min(1, "Cần nhập kết quả công việc").max(5000),
  challenges: z.string().trim().max(3000).optional().nullable(),
  planForNextDay: z.string().trim().max(3000).optional().nullable()
});

const cvMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);
const cvExtensions = new Set(["pdf", "doc", "docx"]);
const cvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = file.originalname.split(".").pop()?.toLowerCase() || "";
    if (!cvMimeTypes.has(file.mimetype) || !cvExtensions.has(extension)) {
      callback(new HttpError(422, "CV chỉ hỗ trợ tệp PDF, DOC hoặc DOCX", "INVALID_CV_FILE"));
      return;
    }
    callback(null, true);
  }
});

type WeeklyScheduleBody = z.infer<typeof weeklyScheduleSchema>;

const loginFilters = (value: string) => {
  const trimmed = value.trim();
  const aliasEmail = loginAliases[trimmed.toLowerCase()];
  const filters = [
    { username: { equals: trimmed, mode: "insensitive" as const } },
    { email: { equals: trimmed, mode: "insensitive" as const } }
  ];

  if (aliasEmail) {
    filters.push({ email: { equals: aliasEmail, mode: "insensitive" as const } });
  }

  return filters;
};

const parseWeekStart = (value: string) => new Date(`${value}T00:00:00.000Z`);
const parseDateInput = (value?: string | null) => (value ? new Date(`${value}T00:00:00.000Z`) : null);
const parseWorkDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

const scheduleFieldsFromDays = (days: WeeklyScheduleBody["days"]) => ({
  mondayStart: days.monday.working ? days.monday.start : null,
  mondayEnd: days.monday.working ? days.monday.end : null,
  tuesdayStart: days.tuesday.working ? days.tuesday.start : null,
  tuesdayEnd: days.tuesday.working ? days.tuesday.end : null,
  wednesdayStart: days.wednesday.working ? days.wednesday.start : null,
  wednesdayEnd: days.wednesday.working ? days.wednesday.end : null,
  thursdayStart: days.thursday.working ? days.thursday.start : null,
  thursdayEnd: days.thursday.working ? days.thursday.end : null,
  fridayStart: days.friday.working ? days.friday.start : null,
  fridayEnd: days.friday.working ? days.friday.end : null,
  saturdayStart: days.saturday.working ? days.saturday.start : null,
  saturdayEnd: days.saturday.working ? days.saturday.end : null,
  sundayStart: days.sunday.working ? days.sunday.start : null,
  sundayEnd: days.sunday.working ? days.sunday.end : null
});

const scheduleDay = (start?: string | null, end?: string | null) => ({
  working: Boolean(start && end),
  start: start || "",
  end: end || ""
});

const serializeSchedule = (schedule: WeeklyWorkSchedule) => ({
  id: schedule.id,
  weekStart: schedule.weekStart.toISOString().slice(0, 10),
  note: schedule.note || "",
  days: {
    monday: scheduleDay(schedule.mondayStart, schedule.mondayEnd),
    tuesday: scheduleDay(schedule.tuesdayStart, schedule.tuesdayEnd),
    wednesday: scheduleDay(schedule.wednesdayStart, schedule.wednesdayEnd),
    thursday: scheduleDay(schedule.thursdayStart, schedule.thursdayEnd),
    friday: scheduleDay(schedule.fridayStart, schedule.fridayEnd),
    saturday: scheduleDay(schedule.saturdayStart, schedule.saturdayEnd),
    sunday: scheduleDay(schedule.sundayStart, schedule.sundayEnd)
  },
  updatedAt: schedule.updatedAt
});

const serializeInternReport = (report: InternDailyReport) => ({
  id: report.id,
  workDate: report.workDate.toISOString().slice(0, 10),
  workSummary: report.workSummary,
  result: report.result,
  challenges: report.challenges || "",
  planForNextDay: report.planForNextDay || "",
  createdAt: report.createdAt,
  updatedAt: report.updatedAt
});

const serializeCv = (cv: { id: string; fileName: string; mimeType: string; fileSize: number; updatedAt: Date }) => ({
  id: cv.id,
  fileName: cv.fileName,
  mimeType: cv.mimeType,
  fileSize: cv.fileSize,
  updatedAt: cv.updatedAt
});

const ensureIntern = (role: UserRole) => {
  if (role !== UserRole.INTERN) {
    throw new HttpError(403, "Chỉ nhân viên thực tập được sử dụng chức năng này", "INTERN_ONLY");
  }
};

export const authRouter = Router();

authRouter.post(
  "/login",
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const loginValue = req.body.account || req.body.email;
    const user = await prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: loginFilters(loginValue)
      }
    });

    if (!user || !(await verifyPassword(req.body.password, user.passwordHash))) {
      throw new HttpError(401, "Tài khoản hoặc mật khẩu không đúng", "INVALID_CREDENTIALS");
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new HttpError(403, "Tài khoản người dùng đang bị khóa", "USER_INACTIVE");
    }

    const token = signAccessToken({ sub: user.id, role: user.role });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        employeeCode: user.employeeCode,
        department: user.department,
        positionTitle: user.positionTitle,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        citizenId: user.citizenId,
        citizenIssuedDate: user.citizenIssuedDate,
        citizenIssuedPlace: user.citizenIssuedPlace,
        currentAddress: user.currentAddress,
        hometown: user.hometown,
        emergencyContactName: user.emergencyContactName,
        emergencyContactPhone: user.emergencyContactPhone,
        startDate: user.startDate,
        personalNote: user.personalNote,
        bankAccountNumber: user.bankAccountNumber,
        bankName: user.bankName,
        bankAccountHolder: user.bankAccountHolder,
        role: user.role,
        status: user.status
      }
    });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
);

authRouter.patch(
  "/me",
  requireAuth,
  validate({ body: updateMeSchema }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        name: req.body.name,
        phone: req.body.phone || null,
        employeeCode: req.body.employeeCode || null,
        department: req.body.department || null,
        positionTitle: req.body.positionTitle || null,
        dateOfBirth: parseDateInput(req.body.dateOfBirth),
        gender: req.body.gender || null,
        citizenId: req.body.citizenId || null,
        citizenIssuedDate: parseDateInput(req.body.citizenIssuedDate),
        citizenIssuedPlace: req.body.citizenIssuedPlace || null,
        currentAddress: req.body.currentAddress || null,
        hometown: req.body.hometown || null,
        emergencyContactName: req.body.emergencyContactName || null,
        emergencyContactPhone: req.body.emergencyContactPhone || null,
        startDate: parseDateInput(req.body.startDate),
        personalNote: req.body.personalNote || null,
        bankAccountNumber: req.body.bankAccountNumber || null,
        bankName: req.body.bankName || null,
        bankAccountHolder: req.body.bankAccountHolder || null
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        employeeCode: true,
        department: true,
        positionTitle: true,
        dateOfBirth: true,
        gender: true,
        citizenId: true,
        citizenIssuedDate: true,
        citizenIssuedPlace: true,
        currentAddress: true,
        hometown: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        startDate: true,
        personalNote: true,
        bankAccountNumber: true,
        bankName: true,
        bankAccountHolder: true,
        role: true,
        status: true
      }
    });

    res.json({ user });
  })
);

authRouter.get(
  "/me/schedule",
  requireAuth,
  validate({ query: scheduleQuerySchema }),
  asyncHandler(async (req, res) => {
    const weekStart = parseWeekStart(String(req.query.weekStart));
    const schedule = await prisma.weeklyWorkSchedule.findUnique({
      where: {
        userId_weekStart: {
          userId: req.user!.id,
          weekStart
        }
      }
    });

    res.json({ schedule: schedule ? serializeSchedule(schedule) : null });
  })
);

authRouter.put(
  "/me/schedule",
  requireAuth,
  validate({ body: weeklyScheduleSchema }),
  asyncHandler(async (req, res) => {
    const weekStart = parseWeekStart(req.body.weekStart);
    const dayFields = scheduleFieldsFromDays(req.body.days);
    const schedule = await prisma.weeklyWorkSchedule.upsert({
      where: {
        userId_weekStart: {
          userId: req.user!.id,
          weekStart
        }
      },
      update: {
        ...dayFields,
        note: req.body.note || null
      },
      create: {
        userId: req.user!.id,
        weekStart,
        ...dayFields,
        note: req.body.note || null
      }
    });

    res.json({ schedule: serializeSchedule(schedule) });
  })
);

authRouter.get(
  "/me/daily-report",
  requireAuth,
  validate({ query: reportQuerySchema }),
  asyncHandler(async (req, res) => {
    if (req.user!.role !== UserRole.INTERN) {
      throw new HttpError(403, "Chỉ nhân viên thực tập được sử dụng báo cáo ngày", "INTERN_ONLY_REPORT");
    }

    const report = await prisma.internDailyReport.findUnique({
      where: {
        userId_workDate: {
          userId: req.user!.id,
          workDate: parseWorkDate(String(req.query.workDate))
        }
      }
    });

    res.json({ report: report ? serializeInternReport(report) : null });
  })
);

authRouter.put(
  "/me/daily-report",
  requireAuth,
  validate({ body: reportBodySchema }),
  asyncHandler(async (req, res) => {
    if (req.user!.role !== UserRole.INTERN) {
      throw new HttpError(403, "Chỉ nhân viên thực tập được sử dụng báo cáo ngày", "INTERN_ONLY_REPORT");
    }

    const workDate = parseWorkDate(req.body.workDate);
    const report = await prisma.internDailyReport.upsert({
      where: { userId_workDate: { userId: req.user!.id, workDate } },
      update: {
        workSummary: req.body.workSummary,
        result: req.body.result,
        challenges: req.body.challenges || null,
        planForNextDay: req.body.planForNextDay || null
      },
      create: {
        userId: req.user!.id,
        workDate,
        workSummary: req.body.workSummary,
        result: req.body.result,
        challenges: req.body.challenges || null,
        planForNextDay: req.body.planForNextDay || null
      }
    });

    res.json({ report: serializeInternReport(report) });
  })
);

authRouter.get(
  "/me/cv",
  requireAuth,
  asyncHandler(async (req, res) => {
    ensureIntern(req.user!.role);
    const cv = await prisma.internCv.findUnique({
      where: { userId: req.user!.id },
      select: { id: true, fileName: true, mimeType: true, fileSize: true, updatedAt: true }
    });
    res.json({ cv: cv ? serializeCv(cv) : null });
  })
);

authRouter.put(
  "/me/cv",
  requireAuth,
  cvUpload.single("cv"),
  asyncHandler(async (req, res) => {
    ensureIntern(req.user!.role);
    if (!req.file) {
      throw new HttpError(422, "Cần chọn tệp CV", "CV_FILE_REQUIRED");
    }

    const fileName = req.file.originalname.trim().replace(/[\r\n"]/g, "").slice(0, 180) || "CV.pdf";
    const cv = await prisma.internCv.upsert({
      where: { userId: req.user!.id },
      update: {
        fileName,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        content: req.file.buffer
      },
      create: {
        userId: req.user!.id,
        fileName,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        content: req.file.buffer
      },
      select: { id: true, fileName: true, mimeType: true, fileSize: true, updatedAt: true }
    });

    res.json({ cv: serializeCv(cv) });
  })
);

authRouter.get(
  "/me/cv/download",
  requireAuth,
  asyncHandler(async (req, res) => {
    ensureIntern(req.user!.role);
    const cv = await prisma.internCv.findUnique({ where: { userId: req.user!.id } });
    if (!cv) throw new HttpError(404, "Chưa có CV", "CV_NOT_FOUND");

    res.setHeader("content-type", cv.mimeType);
    res.setHeader("content-length", String(cv.fileSize));
    res.setHeader("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(cv.fileName)}`);
    res.send(Buffer.from(cv.content));
  })
);

authRouter.delete(
  "/me/cv",
  requireAuth,
  asyncHandler(async (req, res) => {
    ensureIntern(req.user!.role);
    await prisma.internCv.deleteMany({ where: { userId: req.user!.id } });
    res.json({ deleted: true });
  })
);
