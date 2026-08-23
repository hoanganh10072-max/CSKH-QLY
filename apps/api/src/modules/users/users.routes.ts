import { Router } from "express";
import { ConsultationCallStatus, CustomerStatus, UserRole, UserStatus } from "@prisma/client";
import type { DailyWorkKpi, WeeklyWorkSchedule } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { HttpError, notFound } from "../../lib/http-error.js";
import { hashPassword } from "../../lib/password.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";

const usernameSchema = z
  .string()
  .trim()
  .min(2, "Tên đăng nhập quá ngắn")
  .max(40, "Tên đăng nhập quá dài")
  .regex(/^[A-Za-z0-9._-]+$/, "Tên đăng nhập chỉ gồm chữ, số, dấu chấm, gạch dưới hoặc gạch ngang");
const emailSchema = z.string().email().transform((value) => value.toLowerCase());

const createUserSchema = z.object({
  name: z.string().trim().min(2),
  username: usernameSchema,
  email: emailSchema,
  phone: z.string().trim().optional().nullable(),
  bankAccountNumber: z.string().trim().max(50).optional().nullable(),
  bankName: z.string().trim().max(100).optional().nullable(),
  bankAccountHolder: z.string().trim().max(100).optional().nullable(),
  password: z.string().trim().min(1, "Cần nhập mật khẩu"),
  role: z.nativeEnum(UserRole).default(UserRole.STAFF),
  status: z.nativeEnum(UserStatus).default(UserStatus.ACTIVE)
});

const updateUserSchema = z.object({
  name: z.string().trim().min(2).optional(),
  phone: z.string().trim().optional().nullable(),
  employeeCode: z.string().trim().max(50).optional().nullable(),
  department: z.string().trim().max(100).optional().nullable(),
  positionTitle: z.string().trim().max(100).optional().nullable(),
  gender: z.string().trim().max(30).optional().nullable(),
  citizenId: z.string().trim().max(30).optional().nullable(),
  citizenIssuedPlace: z.string().trim().max(150).optional().nullable(),
  currentAddress: z.string().trim().max(300).optional().nullable(),
  hometown: z.string().trim().max(200).optional().nullable(),
  emergencyContactName: z.string().trim().max(120).optional().nullable(),
  emergencyContactPhone: z.string().trim().max(30).optional().nullable(),
  personalNote: z.string().trim().max(1000).optional().nullable(),
  bankAccountNumber: z.string().trim().max(50).optional().nullable(),
  bankName: z.string().trim().max(100).optional().nullable(),
  bankAccountHolder: z.string().trim().max(100).optional().nullable(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional()
});

const updateAccountSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(UserStatus),
  password: z.string().trim().optional().nullable()
});

const userIdParams = z.object({ id: z.string().uuid() });
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
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

const kpiPeriodModeSchema = z.enum(["day", "month", "year"]);
const monthRegex = /^\d{4}-\d{2}$/;
const yearRegex = /^\d{4}$/;

const kpiPeriodSchema = z
  .object({
    mode: kpiPeriodModeSchema.default("day"),
    period: z.string().optional(),
    date: z.string().optional()
  })
  .transform((value) => ({
    mode: value.mode,
    period: value.period || value.date || ""
  }))
  .superRefine((value, context) => {
    const valid =
      (value.mode === "day" && dateRegex.test(value.period)) ||
      (value.mode === "month" && monthRegex.test(value.period)) ||
      (value.mode === "year" && yearRegex.test(value.period));

    if (!valid) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["period"], message: "Kỳ KPI không hợp lệ" });
    }
  });

const kpiTargetSchema = z.object({
  mode: kpiPeriodModeSchema,
  period: z.string().min(4),
  targetCustomers: z.coerce.number().int().min(0).max(100000)
}).superRefine((value, context) => {
  const valid =
    (value.mode === "day" && dateRegex.test(value.period)) ||
    (value.mode === "month" && monthRegex.test(value.period)) ||
    (value.mode === "year" && yearRegex.test(value.period));

  if (!valid) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["period"], message: "Kỳ KPI không hợp lệ" });
  }
});

const dailyWorkKpiSchema = z.object({
  workDate: z.string().regex(dateRegex, "Ngày KPI không hợp lệ"),
  targetCustomers: z.coerce.number().int().min(0).max(100000),
  receivedCustomers: z.coerce.number().int().min(0).max(100000),
  calledCustomers: z.coerce.number().int().min(0).max(100000),
  successfulCalls: z.coerce.number().int().min(0).max(100000),
  interestedCustomers: z.coerce.number().int().min(0).max(100000),
  revenue: z.coerce.number().min(0).max(999999999999),
  note: z.string().trim().max(500).optional().nullable()
});

type WeeklyScheduleBody = z.infer<typeof weeklyScheduleSchema>;
type KpiPeriod = z.infer<typeof kpiPeriodSchema>;

const parseWeekStart = (value: string) => new Date(`${value}T00:00:00.000Z`);
const parseWorkDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
const kpiRangeFromPeriod = ({ mode, period }: KpiPeriod) => {
  if (mode === "year") {
    const year = Number(period);
    return {
      start: new Date(Date.UTC(year, 0, 1)),
      end: new Date(Date.UTC(year + 1, 0, 1))
    };
  }

  if (mode === "month") {
    const [year, month] = period.split("-").map(Number);
    return {
      start: new Date(Date.UTC(year, month - 1, 1)),
      end: new Date(Date.UTC(year, month, 1))
    };
  }

  const start = parseWorkDate(period);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
};

const duplicateAccountWhere = (username: string, email: string, excludedUserId?: string) => ({
  id: excludedUserId ? { not: excludedUserId } : undefined,
  OR: [
    { username: { equals: username, mode: "insensitive" as const } },
    { email: { equals: email, mode: "insensitive" as const } }
  ]
});

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
  userId: schedule.userId,
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

const serializeDailyWorkKpi = (kpi: DailyWorkKpi) => ({
  id: kpi.id,
  userId: kpi.userId,
  workDate: kpi.workDate.toISOString().slice(0, 10),
  targetCustomers: kpi.targetCustomers,
  receivedCustomers: kpi.receivedCustomers,
  calledCustomers: kpi.calledCustomers,
  successfulCalls: kpi.successfulCalls,
  interestedCustomers: kpi.interestedCustomers,
  revenue: Number(kpi.revenue || 0),
  note: kpi.note || "",
  updatedAt: kpi.updatedAt
});

export const userRouter = Router();

userRouter.use(requireAuth, requireRole(UserRole.ADMIN));

userRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [users, revenueRows] = await Promise.all([
      prisma.user.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
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
          status: true,
          createdAt: true,
          _count: {
            select: {
              ownedCustomers: true,
              interactions: true,
              tasks: true
            }
          }
        }
      }),
      prisma.customer.groupBy({
        by: ["ownerId"],
        where: { ownerId: { not: null } },
        _sum: { revenue: true }
      })
    ]);

    const revenueByUser = new Map(
      revenueRows.map((row) => [row.ownerId, Number(row._sum.revenue || 0)])
    );

    res.json({
      users: users.map((user) => ({
        ...user,
        revenue: revenueByUser.get(user.id) || 0
      }))
    });
  })
);

userRouter.post(
  "/",
  validate({ body: createUserSchema }),
  asyncHandler(async (req, res) => {
    const { password, ...data } = req.body;
    const duplicate = await prisma.user.findFirst({
      where: duplicateAccountWhere(data.username, data.email)
    });

    if (duplicate) {
      throw new HttpError(409, "Tên đăng nhập hoặc thư điện tử đã tồn tại", "DUPLICATE");
    }

    const user = await prisma.user.create({
      data: {
        ...data,
        role: UserRole.STAFF,
        status: UserStatus.ACTIVE,
        phone: data.phone || null,
        passwordHash: await hashPassword(password)
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
        status: true,
        createdAt: true,
        _count: {
          select: {
            ownedCustomers: true,
            interactions: true,
            tasks: true
          }
        }
      }
    });

    res.status(201).json({ user: { ...user, revenue: 0 } });
  })
);

userRouter.patch(
  "/:id",
  validate({ params: userIdParams, body: updateUserSchema }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...req.body,
        phone: req.body.phone || null
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
        status: true,
        createdAt: true
      }
    });

    res.json({ user });
  })
);

userRouter.patch(
  "/:id/account",
  validate({ params: userIdParams, body: updateAccountSchema }),
  asyncHandler(async (req, res) => {
    const targetId = req.params.id;
    const targetUser = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, role: true, deletedAt: true }
    });

    if (!targetUser || targetUser.deletedAt) {
      throw notFound("User");
    }

    if (targetId === req.user?.id && (req.body.role !== UserRole.ADMIN || req.body.status !== UserStatus.ACTIVE)) {
      throw new HttpError(400, "Không thể tự hạ quyền hoặc khóa tài khoản đang đăng nhập", "UPDATE_SELF_ACCOUNT");
    }

    const duplicate = await prisma.user.findFirst({
      where: duplicateAccountWhere(req.body.username, req.body.email, targetId)
    });

    if (duplicate) {
      throw new HttpError(409, "Tên đăng nhập hoặc thư điện tử đã tồn tại", "DUPLICATE");
    }

    if (targetUser.role === UserRole.ADMIN && (req.body.role !== UserRole.ADMIN || req.body.status !== UserStatus.ACTIVE)) {
      const remainingAdmins = await prisma.user.count({
        where: {
          id: { not: targetId },
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          deletedAt: null
        }
      });

      if (remainingAdmins === 0) {
        throw new HttpError(400, "Không thể khóa hoặc hạ quyền quản trị viên cuối cùng", "LAST_ADMIN");
      }
    }

    const user = await prisma.user.update({
      where: { id: targetId },
      data: {
        username: req.body.username,
        email: req.body.email,
        role: req.body.role,
        status: req.body.status,
        ...(req.body.password ? { passwordHash: await hashPassword(req.body.password) } : {})
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        status: true,
        createdAt: true
      }
    });

    res.json({ user });
  })
);

userRouter.delete(
  "/:id",
  validate({ params: userIdParams }),
  asyncHandler(async (req, res) => {
    const targetId = req.params.id;

    if (targetId === req.user?.id) {
      throw new HttpError(400, "Không thể xóa tài khoản đang đăng nhập", "DELETE_SELF");
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, role: true, deletedAt: true }
    });

    if (!targetUser || targetUser.deletedAt) {
      throw notFound("User");
    }

    if (targetUser.role === UserRole.ADMIN) {
      const remainingAdmins = await prisma.user.count({
        where: {
          id: { not: targetId },
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          deletedAt: null
        }
      });

      if (remainingAdmins === 0) {
        throw new HttpError(400, "Không thể xóa quản trị viên cuối cùng", "LAST_ADMIN");
      }
    }

    const user = await prisma.user.update({
      where: { id: targetId },
      data: {
        status: UserStatus.INACTIVE,
        deletedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        deletedAt: true
      }
    });

    res.json({ user });
  })
);

userRouter.get(
  "/work-kpis",
  validate({ query: kpiPeriodSchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as KpiPeriod;
    const { start, end } = kpiRangeFromPeriod(query);
    const [target, receivedRows, calledRows, successfulRows, interestedRows, revenueRows] = await Promise.all([
      prisma.workKpiTarget.findUnique({
        where: {
          periodMode_periodKey: {
            periodMode: query.mode,
            periodKey: query.period
          }
        }
      }),
      prisma.customerOwnership.groupBy({
        by: ["userId"],
        where: { assignedDate: { gte: start, lt: end } },
        _count: { _all: true }
      }),
      prisma.customerInteraction.groupBy({
        by: ["userId"],
        where: { createdAt: { gte: start, lt: end }, callStatus: { not: null } },
        _count: { _all: true }
      }),
      prisma.customerInteraction.groupBy({
        by: ["userId"],
        where: { createdAt: { gte: start, lt: end }, callStatus: ConsultationCallStatus.CALLED },
        _count: { _all: true }
      }),
      prisma.customer.groupBy({
        by: ["ownerId"],
        where: {
          ownerId: { not: null },
          status: CustomerStatus.INTERESTED,
          updatedAt: { gte: start, lt: end }
        },
        _count: { _all: true }
      }),
      prisma.customer.groupBy({
        by: ["ownerId"],
        where: {
          ownerId: { not: null },
          updatedAt: { gte: start, lt: end }
        },
        _sum: { revenue: true }
      })
    ]);

    const receivedByUser = new Map(receivedRows.map((row) => [row.userId, row._count._all]));
    const calledByUser = new Map(calledRows.map((row) => [row.userId, row._count._all]));
    const successfulByUser = new Map(successfulRows.map((row) => [row.userId, row._count._all]));
    const interestedByUser = new Map(interestedRows.map((row) => [row.ownerId, row._count._all]));
    const revenueByUser = new Map(revenueRows.map((row) => [row.ownerId, Number(row._sum.revenue || 0)]));

    const userIds = new Set<string>([
      ...receivedByUser.keys(),
      ...calledByUser.keys(),
      ...successfulByUser.keys(),
      ...(Array.from(interestedByUser.keys()).filter(Boolean) as string[]),
      ...(Array.from(revenueByUser.keys()).filter(Boolean) as string[])
    ]);

    res.json({
      mode: query.mode,
      period: query.period,
      targetCustomers: target?.targetCustomers || 0,
      items: Array.from(userIds).map((userId) => ({
        userId,
        receivedCustomers: receivedByUser.get(userId) || 0,
        calledCustomers: calledByUser.get(userId) || 0,
        successfulCalls: successfulByUser.get(userId) || 0,
        interestedCustomers: interestedByUser.get(userId) || 0,
        revenue: revenueByUser.get(userId) || 0
      }))
    });
  })
);

userRouter.put(
  "/work-kpis/target",
  validate({ body: kpiTargetSchema }),
  asyncHandler(async (req, res) => {
    const target = await prisma.workKpiTarget.upsert({
      where: {
        periodMode_periodKey: {
          periodMode: req.body.mode,
          periodKey: req.body.period
        }
      },
      update: { targetCustomers: req.body.targetCustomers },
      create: {
        periodMode: req.body.mode,
        periodKey: req.body.period,
        targetCustomers: req.body.targetCustomers
      }
    });

    res.json({
      target: {
        mode: target.periodMode,
        period: target.periodKey,
        targetCustomers: target.targetCustomers
      }
    });
  })
);

userRouter.put(
  "/:id/work-kpis",
  validate({ params: userIdParams, body: dailyWorkKpiSchema }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, deletedAt: true }
    });

    if (!user || user.deletedAt) {
      throw notFound("User");
    }

    const workDate = parseWorkDate(req.body.workDate);
    const kpiPayload = {
      targetCustomers: req.body.targetCustomers,
      receivedCustomers: req.body.receivedCustomers,
      calledCustomers: req.body.calledCustomers,
      successfulCalls: req.body.successfulCalls,
      interestedCustomers: req.body.interestedCustomers,
      revenue: req.body.revenue,
      note: req.body.note || null
    };

    const item = await prisma.dailyWorkKpi.upsert({
      where: {
        userId_workDate: {
          userId: req.params.id,
          workDate
        }
      },
      update: kpiPayload,
      create: {
        userId: req.params.id,
        workDate,
        ...kpiPayload
      }
    });

    res.json({ item: serializeDailyWorkKpi(item) });
  })
);

userRouter.get(
  "/schedules",
  validate({ query: scheduleQuerySchema }),
  asyncHandler(async (req, res) => {
    const weekStart = parseWeekStart(String(req.query.weekStart));
    const schedules = await prisma.weeklyWorkSchedule.findMany({
      where: { weekStart }
    });

    res.json({ schedules: schedules.map(serializeSchedule) });
  })
);

userRouter.get(
  "/:id/schedule",
  validate({ params: userIdParams, query: scheduleQuerySchema }),
  asyncHandler(async (req, res) => {
    const weekStart = parseWeekStart(String(req.query.weekStart));
    const schedule = await prisma.weeklyWorkSchedule.findUnique({
      where: {
        userId_weekStart: {
          userId: req.params.id,
          weekStart
        }
      }
    });

    res.json({ schedule: schedule ? serializeSchedule(schedule) : null });
  })
);

userRouter.put(
  "/:id/schedule",
  validate({ params: userIdParams, body: weeklyScheduleSchema }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!user) {
      throw notFound("User");
    }

    const weekStart = parseWeekStart(req.body.weekStart);
    const dayFields = scheduleFieldsFromDays(req.body.days);
    const schedule = await prisma.weeklyWorkSchedule.upsert({
      where: {
        userId_weekStart: {
          userId: req.params.id,
          weekStart
        }
      },
      update: {
        ...dayFields,
        note: req.body.note || null
      },
      create: {
        userId: req.params.id,
        weekStart,
        ...dayFields,
        note: req.body.note || null
      }
    });

    res.json({ schedule: serializeSchedule(schedule) });
  })
);
