import { Router } from "express";
import { TaskStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { HttpError, notFound } from "../../lib/http-error.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";

const createTaskSchema = z.object({
  customerId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  title: z.string().trim().min(1),
  deadline: z.coerce.date()
});

const listTasksQuery = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  customerId: z.string().uuid().optional(),
  due: z.enum(["today", "overdue", "all"]).default("all")
});

const updateTaskSchema = z.object({
  title: z.string().trim().min(1).optional(),
  deadline: z.coerce.date().optional(),
  status: z.nativeEnum(TaskStatus).optional()
});

export const taskRouter = Router();

taskRouter.use(requireAuth, requireRole(UserRole.ADMIN));

taskRouter.get(
  "/",
  validate({ query: listTasksQuery }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as z.infer<typeof listTasksQuery>;
    const where: Record<string, unknown> = {};

    if (req.user!.role !== UserRole.ADMIN) {
      where.userId = req.user!.id;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.customerId) {
      where.customerId = query.customerId;
    }

    if (query.due === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      where.deadline = { gte: start, lt: end };
    } else if (query.due === "overdue") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      where.deadline = { lt: start };
      where.status = TaskStatus.TODO;
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { deadline: "asc" },
      include: {
        customer: { select: { id: true, name: true, phone: true, status: true } },
        user: { select: { id: true, name: true, email: true } }
      }
    });

    res.json({ tasks });
  })
);

taskRouter.post(
  "/",
  validate({ body: createTaskSchema }),
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({
      where: { id: req.body.customerId },
      select: { id: true, ownerId: true }
    });

    if (!customer) {
      throw notFound("Customer");
    }

    const userId = req.user!.role === UserRole.ADMIN ? req.body.userId || customer.ownerId : req.user!.id;

    if (!userId) {
      throw new HttpError(422, "Công việc cần có người phụ trách", "TASK_USER_REQUIRED");
    }

    if (req.user!.role !== UserRole.ADMIN && customer.ownerId !== req.user!.id) {
      throw new HttpError(403, "Bạn chỉ được tạo công việc cho khách hàng được giao cho mình", "CUSTOMER_NOT_ASSIGNED");
    }

    const task = await prisma.task.create({
      data: {
        customerId: req.body.customerId,
        userId,
        title: req.body.title,
        deadline: req.body.deadline
      },
      include: {
        customer: { select: { id: true, name: true, phone: true, status: true } },
        user: { select: { id: true, name: true, email: true } }
      }
    });

    res.status(201).json({ task });
  })
);

taskRouter.patch(
  "/:id",
  validate({ params: z.object({ id: z.string().uuid() }), body: updateTaskSchema }),
  asyncHandler(async (req, res) => {
    const current = await prisma.task.findUnique({ where: { id: req.params.id } });

    if (!current) {
      throw notFound("Task");
    }

    if (req.user!.role !== UserRole.ADMIN && current.userId !== req.user!.id) {
      throw new HttpError(403, "Bạn chỉ được cập nhật công việc của mình", "TASK_NOT_ASSIGNED");
    }

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: req.body,
      include: {
        customer: { select: { id: true, name: true, phone: true, status: true } },
        user: { select: { id: true, name: true, email: true } }
      }
    });

    res.json({ task });
  })
);
