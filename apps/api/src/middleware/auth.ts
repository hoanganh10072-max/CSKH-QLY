import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";
import { UserStatus } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { verifyAccessToken } from "../lib/jwt.js";

export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const header = req.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      throw new HttpError(401, "Thiếu mã đăng nhập", "UNAUTHORIZED");
    }

    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
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
        deletedAt: true
      }
    });

    if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE) {
      throw new HttpError(401, "Tài khoản không hoạt động", "UNAUTHORIZED");
    }

    req.user = user;
    next();
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(401, "Mã đăng nhập không hợp lệ", "UNAUTHORIZED"));
  }
};

export const requireRole =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new HttpError(401, "Thiếu thông tin người dùng đã đăng nhập", "UNAUTHORIZED"));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new HttpError(403, "Bạn không có quyền thực hiện thao tác này", "FORBIDDEN"));
      return;
    }

    next();
  };
