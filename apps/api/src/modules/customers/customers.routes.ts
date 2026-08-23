import { Router } from "express";
import { ConsultationCallStatus, CustomerStatus, OwnershipStatus, Prisma, UserRole } from "@prisma/client";
import multer from "multer";
import { z } from "zod";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { startOfToday, startOfTomorrow } from "../../lib/date.js";
import { HttpError, notFound } from "../../lib/http-error.js";
import { saveCallHistoryImage } from "../../lib/supabase-storage.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { importCustomersFromExcel } from "./import.service.js";
import {
  addInteractionSchema,
  customerIdParams,
  listCustomersQuery,
  updateCustomerSchema
} from "./customers.schemas.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!file.originalname.match(/\.xlsx$/i)) {
      callback(new HttpError(422, "Chỉ hỗ trợ tệp .xlsx", "INVALID_FILE_TYPE"));
      return;
    }
    callback(null, true);
  }
});

const importRequestBodySchema = z.object({
  importName: z.string().trim().min(1, "Cần đặt tên lô dữ liệu").max(120, "Tên lô dữ liệu quá dài")
});

export const customerRouter = Router();

customerRouter.use(requireAuth);

const ensureCustomerAccess = async (customerId: string, userId: string, role: UserRole) => {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, ownerId: true }
  });

  if (!customer) {
    throw notFound("Customer");
  }

  if (role !== UserRole.ADMIN && customer.ownerId !== userId) {
    throw new HttpError(403, "Bạn chỉ được cập nhật khách hàng được giao cho mình", "CUSTOMER_NOT_ASSIGNED");
  }

  return customer;
};

const staffOutcomeStatuses = new Set<CustomerStatus>([
  CustomerStatus.INTERESTED,
  CustomerStatus.NOT_INTERESTED
]);

const parseLocalDateRange = (value: string) => {
  const start = new Date(`${value}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

const redactStaffCustomer = <T extends { revenue?: unknown; tasks?: unknown; ownerships?: unknown }>(customer: T) => {
  const { revenue: _revenue, tasks: _tasks, ownerships: _ownerships, ...safeCustomer } = customer;
  return safeCustomer;
};

const serializeCustomerListItem = <T extends { ownerships?: Array<{ assignedDate: Date | string }> }>(customer: T) => {
  const { ownerships: _ownerships, ...rest } = customer;

  return {
    ...rest,
    receivedAt: _ownerships?.[0]?.assignedDate || null
  };
};

customerRouter.get(
  "/",
  validate({ query: listCustomersQuery }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as z.infer<typeof listCustomersQuery>;
    const filters: Prisma.CustomerWhereInput[] = [];
    const isAdmin = req.user?.role === UserRole.ADMIN;

    if (query.search) {
      filters.push({
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { companyHead: { contains: query.search, mode: "insensitive" } },
          { phone: { contains: query.search, mode: "insensitive" } },
          { email: { contains: query.search, mode: "insensitive" } },
          { address: { contains: query.search, mode: "insensitive" } },
          { city: { contains: query.search, mode: "insensitive" } },
          { source: { contains: query.search, mode: "insensitive" } },
          { importHistory: { is: { importName: { contains: query.search, mode: "insensitive" } } } }
        ]
      });
    }

    if (query.status) {
      filters.push({ status: query.status });
    }

    if (query.callState === "called") {
      filters.push({ interactions: { some: { callStatus: { not: null } } } });
    } else if (query.callState === "not_called") {
      filters.push({ interactions: { none: { callStatus: { not: null } } } });
    }

    if (query.receivedDate) {
      const { start, end } = parseLocalDateRange(query.receivedDate);
      filters.push({
        ownerships: {
          some: {
            status: OwnershipStatus.ACTIVE,
            assignedDate: { gte: start, lt: end },
            ...(isAdmin ? {} : { userId: req.user?.id })
          }
        }
      });
    }

    if (isAdmin) {
      if (query.owner === "me") {
        filters.push({ ownerId: req.user?.id });
      } else if (query.owner === "unassigned") {
        filters.push({ ownerId: null });
      } else if (query.owner === "assigned") {
        filters.push({ ownerId: { not: null } });
      }
    } else if (query.owner === "me" || query.owner === "assigned") {
      filters.push({ ownerId: req.user?.id });
    } else if (query.owner === "unassigned") {
      filters.push({ ownerId: null });
    } else {
      filters.push({ OR: [{ ownerId: null }, { ownerId: req.user?.id }] });
    }

    const where: Prisma.CustomerWhereInput = filters.length ? { AND: filters } : {};
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { [query.sortBy]: query.sortOrder },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          importHistory: { select: { id: true, importName: true, filename: true } },
          ownerships: {
            where: {
              status: OwnershipStatus.ACTIVE,
              ...(isAdmin ? {} : { userId: req.user?.id })
            },
            orderBy: { assignedDate: "desc" },
            take: 1,
            select: { assignedDate: true }
          },
          interactions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              note: true,
              result: true,
              callStatus: true,
              messageStatus: true,
              noMessageReason: true,
              callHistoryImage: true,
              createdAt: true,
              user: { select: { id: true, name: true } }
            }
          }
        }
      }),
      prisma.customer.count({ where })
    ]);

    const listItems = customers.map(serializeCustomerListItem);

    res.json({
      customers: isAdmin ? listItems : listItems.map(redactStaffCustomer),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize)
      }
    });
  })
);

customerRouter.get(
  "/imports",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (_req, res) => {
    const imports = await prisma.importHistory.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        creator: { select: { id: true, name: true, email: true } },
        customers: {
          orderBy: { createdAt: "desc" },
          include: {
            owner: { select: { id: true, name: true, email: true } },
            interactions: {
              where: { callStatus: { not: null } },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                id: true,
                callStatus: true,
                messageStatus: true,
                noMessageReason: true,
                callHistoryImage: true,
                createdAt: true,
                user: { select: { id: true, name: true } }
              }
            }
          }
        }
      }
    });

    res.json({
      imports: imports.map((item) => {
        const phoneRows = item.customers.filter((customer) => Boolean(customer.phone));
        const calledRows = phoneRows.filter((customer) => customer.interactions.length > 0);

        return {
          id: item.id,
          importName: item.importName || item.filename,
          filename: item.filename,
          totalRows: item.totalRows,
          successRows: item.successRows,
          duplicateRows: item.duplicateRows,
          failedRows: item.failedRows,
          totalPhones: phoneRows.length,
          calledCount: calledRows.length,
          uncalledCount: phoneRows.length - calledRows.length,
          createdAt: item.createdAt,
          creator: item.creator,
          phones: phoneRows.map((customer) => {
            const latestCall = customer.interactions[0] || null;

            return {
              customerId: customer.id,
              companyName: customer.name,
              companyHead: customer.companyHead,
              location: customer.address,
              phone: customer.phone,
              city: customer.city,
              customerStatus: customer.status,
              owner: customer.owner,
              called: Boolean(latestCall),
              callStatus: latestCall?.callStatus || null,
              messageStatus: latestCall?.messageStatus || null,
              noMessageReason: latestCall?.noMessageReason || null,
              callHistoryImage: latestCall?.callHistoryImage || null,
              calledAt: latestCall?.createdAt || null,
              calledBy: latestCall?.user || null
            };
          })
        };
      })
    });
  })
);

customerRouter.get(
  "/receiving-summary",
  requireRole(UserRole.STAFF),
  asyncHandler(async (req, res) => {
    const todayStart = startOfToday();
    const tomorrowStart = startOfTomorrow();
    const [receivedToday, availableCustomers] = await Promise.all([
      prisma.customerOwnership.count({
        where: {
          userId: req.user!.id,
          assignedDate: {
            gte: todayStart,
            lt: tomorrowStart
          }
        }
      }),
      prisma.customer.count({ where: { ownerId: null } })
    ]);

    res.json({
      date: todayStart.toISOString(),
      receivedToday,
      dailyTarget: env.STAFF_DAILY_CUSTOMER_TARGET,
      availableCustomers
    });
  })
);

customerRouter.get(
  "/:id",
  validate({ params: customerIdParams }),
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        importHistory: { select: { id: true, importName: true, filename: true } },
        interactions: {
          orderBy: { createdAt: "desc" },
          include: { user: { select: { id: true, name: true } } }
        },
        tasks: {
          orderBy: { deadline: "asc" },
          include: { user: { select: { id: true, name: true } } }
        },
        ownerships: {
          orderBy: { assignedDate: "desc" },
          include: { user: { select: { id: true, name: true } } }
        }
      }
    });

    if (!customer) {
      throw notFound("Customer");
    }

    if (req.user!.role !== UserRole.ADMIN && customer.ownerId && customer.ownerId !== req.user!.id) {
      throw new HttpError(403, "Bạn chỉ được xem dữ liệu chưa nhận hoặc dữ liệu của mình", "CUSTOMER_NOT_VISIBLE");
    }

    const activeOwnership = customer.ownerships.find((ownership) => {
      if (ownership.status !== OwnershipStatus.ACTIVE) return false;
      return req.user!.role === UserRole.ADMIN || ownership.userId === req.user!.id;
    });
    const customerWithReceivedAt = {
      ...customer,
      receivedAt: activeOwnership?.assignedDate || null
    };

    res.json({
      customer: req.user!.role === UserRole.ADMIN ? customerWithReceivedAt : redactStaffCustomer(customerWithReceivedAt)
    });
  })
);

customerRouter.post(
  "/import",
  requireRole(UserRole.ADMIN),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new HttpError(422, "Cần chọn tệp dữ liệu", "FILE_REQUIRED");
    }

    const body = importRequestBodySchema.parse(req.body);
    const result = await importCustomersFromExcel(req.file, req.user!.id, body.importName);
    res.status(201).json(result);
  })
);

customerRouter.put(
  "/:id",
  validate({ params: customerIdParams, body: updateCustomerSchema }),
  asyncHandler(async (req, res) => {
    await ensureCustomerAccess(req.params.id, req.user!.id, req.user!.role);
    const isAdmin = req.user!.role === UserRole.ADMIN;

    if (!isAdmin && (!req.body.status || !staffOutcomeStatuses.has(req.body.status))) {
      throw new HttpError(
        403,
        "Nhân viên chỉ được cập nhật kết quả khách hàng là Quan tâm hoặc Không quan tâm",
        "STAFF_STATUS_ONLY"
      );
    }

    const data: Prisma.CustomerUpdateInput = isAdmin ? {} : { status: req.body.status };

    if (isAdmin) {
      if (req.body.name !== undefined) data.name = req.body.name;
      if (req.body.companyHead !== undefined) data.companyHead = req.body.companyHead || null;
      if (req.body.phone !== undefined) data.phone = req.body.phone || null;
      if (req.body.email !== undefined) data.email = req.body.email ? req.body.email.toLowerCase() : null;
      if (req.body.address !== undefined) data.address = req.body.address || null;
      if (req.body.city !== undefined) data.city = req.body.city || null;
      if (req.body.source !== undefined) data.source = req.body.source || null;
      if (req.body.status !== undefined) data.status = req.body.status;
      if (req.body.revenue !== undefined) data.revenue = req.body.revenue;
    }

    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        importHistory: { select: { id: true, importName: true, filename: true } }
      }
    });

    res.json({ customer: isAdmin ? customer : redactStaffCustomer(customer) });
  })
);

customerRouter.post(
  "/:id/claim",
  validate({ params: customerIdParams }),
  asyncHandler(async (req, res) => {
    if (req.user!.role !== UserRole.STAFF) {
      throw new HttpError(403, "Chỉ nhân viên được nhận dữ liệu chăm sóc", "STAFF_ONLY_CLAIM");
    }

    const customer = await prisma.$transaction(async (tx) => {
      const existing = await tx.customer.findUnique({
        where: { id: req.params.id },
        include: { owner: { select: { id: true, name: true, email: true } } }
      });

      if (!existing) {
        throw notFound("Customer");
      }

      if (existing.ownerId && existing.ownerId !== req.user!.id) {
        throw new HttpError(
          409,
          "Khách hàng đang được nhân viên khác chăm sóc",
          "CUSTOMER_ALREADY_CLAIMED"
        );
      }

      if (existing.ownerId === req.user!.id) {
        return existing;
      }

      const updated = await tx.customer.updateMany({
        where: { id: req.params.id, ownerId: null },
        data: { ownerId: req.user!.id }
      });

      if (updated.count !== 1) {
        throw new HttpError(
          409,
          "Khách hàng đang được nhân viên khác chăm sóc",
          "CUSTOMER_ALREADY_CLAIMED"
        );
      }

      await tx.customerOwnership.create({
        data: {
          customerId: req.params.id,
          userId: req.user!.id,
          status: OwnershipStatus.ACTIVE
        }
      });

      return tx.customer.findUniqueOrThrow({
        where: { id: req.params.id },
        include: { owner: { select: { id: true, name: true, email: true } } }
      });
    });

    res.json({ customer: redactStaffCustomer(customer) });
  })
);

customerRouter.post(
  "/:id/release",
  validate({ params: customerIdParams }),
  asyncHandler(async (req, res) => {
    const customer = await prisma.$transaction(async (tx) => {
      const existing = await tx.customer.findUnique({
        where: { id: req.params.id },
        select: { id: true, ownerId: true }
      });

      if (!existing) {
        throw notFound("Customer");
      }

      if (req.user!.role !== UserRole.ADMIN) {
        throw new HttpError(403, "Chỉ quản trị viên được trả dữ liệu về kho chung", "ADMIN_ONLY_RELEASE");
      }

      await tx.customer.update({
        where: { id: req.params.id },
        data: { ownerId: null }
      });

      await tx.customerOwnership.updateMany({
        where: {
          customerId: req.params.id,
          status: OwnershipStatus.ACTIVE,
          ...(req.user!.role === UserRole.ADMIN ? {} : { userId: req.user!.id })
        },
        data: {
          status: OwnershipStatus.RELEASED,
          releasedDate: new Date()
        }
      });

      return tx.customer.findUniqueOrThrow({
        where: { id: req.params.id },
        include: { owner: { select: { id: true, name: true, email: true } } }
      });
    });

    res.json({ customer });
  })
);

customerRouter.post(
  "/:id/interactions",
  validate({ params: customerIdParams, body: addInteractionSchema }),
  asyncHandler(async (req, res) => {
    await ensureCustomerAccess(req.params.id, req.user!.id, req.user!.role);

    if (
      req.user!.role !== UserRole.ADMIN &&
      req.body.status &&
      !staffOutcomeStatuses.has(req.body.status)
    ) {
      throw new HttpError(
        403,
        "Nhân viên chỉ được cập nhật kết quả khách hàng là Quan tâm hoặc Không quan tâm",
        "STAFF_STATUS_ONLY"
      );
    }

    const callHistoryImage = await saveCallHistoryImage(req.body.callHistoryImage || null, {
      customerId: req.params.id,
      userId: req.user!.id
    });

    const result = await prisma.$transaction(async (tx) => {
      const interaction = await tx.customerInteraction.create({
        data: {
          customerId: req.params.id,
          userId: req.user!.id,
          note: req.body.note,
          result: req.body.result || null,
          callStatus: req.body.callStatus || null,
          messageStatus:
            req.body.callStatus === ConsultationCallStatus.CALLED ? req.body.messageStatus || null : null,
          noMessageReason:
            req.body.callStatus === ConsultationCallStatus.CALLED && req.body.messageStatus
              ? req.body.noMessageReason || null
              : null,
          callHistoryImage
        },
        include: { user: { select: { id: true, name: true } } }
      });

      const customer = req.body.status
        ? await tx.customer.update({
            where: { id: req.params.id },
            data: { status: req.body.status as CustomerStatus },
            include: { owner: { select: { id: true, name: true, email: true } } }
          })
        : null;

      return {
        interaction,
        customer: customer && req.user!.role !== UserRole.ADMIN ? redactStaffCustomer(customer) : customer
      };
    });

    res.status(201).json(result);
  })
);
