import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { HttpError } from "../lib/http-error.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    res.status(422).json({
      message: error.code === "LIMIT_FILE_SIZE" ? "Tệp tải lên không được vượt quá 5 MB" : "Tệp tải lên không hợp lệ",
      code: error.code
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(422).json({
      message: "Dữ liệu không hợp lệ",
      code: "VALIDATION_ERROR",
      issues: error.issues
    });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ message: error.message, code: error.code });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    res.status(409).json({ message: "Đã tồn tại bản ghi có giá trị trùng lặp", code: "DUPLICATE" });
    return;
  }

  console.error(error);
  res.status(500).json({ message: "Lỗi máy chủ nội bộ", code: "INTERNAL_SERVER_ERROR" });
};
