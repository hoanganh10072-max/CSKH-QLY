import { Router } from "express";
import { CustomerStatus, UserRole, UserStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (req.user?.role === UserRole.ADMIN) {
      const [totalCustomers, unassignedCustomers, activeCustomers, completedCustomers, revenue, staffCount, imports, staff] =
        await Promise.all([
          prisma.customer.count(),
          prisma.customer.count({ where: { ownerId: null } }),
          prisma.customer.count({
            where: { ownerId: { not: null }, status: { not: CustomerStatus.CUSTOMER } }
          }),
          prisma.customer.count({ where: { status: CustomerStatus.CUSTOMER } }),
          prisma.customer.aggregate({ _sum: { revenue: true } }),
          prisma.user.count({ where: { role: UserRole.STAFF, status: UserStatus.ACTIVE, deletedAt: null } }),
          prisma.importHistory.findMany({
            orderBy: { createdAt: "desc" },
            take: 5,
            include: { creator: { select: { id: true, name: true, email: true } } }
          }),
          prisma.user.findMany({
            where: { role: UserRole.STAFF, deletedAt: null },
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
              _count: {
                select: {
                  ownedCustomers: true,
                  interactions: true,
                  tasks: true
                }
              }
            }
          })
        ]);

      res.json({
        role: UserRole.ADMIN,
        metrics: {
          totalCustomers,
          unassignedCustomers,
          activeCustomers,
          completedCustomers,
          revenue: Number(revenue._sum.revenue || 0),
          staffCount
        },
        imports,
        staffPerformance: staff.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          status: user.status,
          ownedCustomers: user._count.ownedCustomers,
          interactions: user._count.interactions,
          tasks: user._count.tasks
        }))
      });
      return;
    }

    const [availableCustomers, myCustomers, interestedCustomers, notInterestedCustomers, myRevenue] = await Promise.all([
      prisma.customer.count({ where: { ownerId: null } }),
      prisma.customer.count({ where: { ownerId: req.user?.id } }),
      prisma.customer.count({ where: { ownerId: req.user?.id, status: CustomerStatus.INTERESTED } }),
      prisma.customer.count({ where: { ownerId: req.user?.id, status: CustomerStatus.NOT_INTERESTED } }),
      prisma.customer.aggregate({
        where: { ownerId: req.user?.id },
        _sum: { revenue: true }
      })
    ]);

    res.json({
      role: UserRole.STAFF,
      metrics: {
        availableCustomers,
        myCustomers,
        interestedCustomers,
        notInterestedCustomers,
        myRevenue: Number(myRevenue._sum.revenue || 0)
      }
    });
  })
);
