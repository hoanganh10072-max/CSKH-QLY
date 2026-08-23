import { Router } from "express";
import { z } from "zod";
import { UserStatus } from "@prisma/client";
import type { WeeklyWorkSchedule } from "@prisma/client";
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
