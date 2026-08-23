import { Prisma } from "@prisma/client";
import readXlsxFile from "read-excel-file/node";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";

const importRowSchema = z
  .object({
    name: z.string().trim().optional().nullable(),
    companyHead: z.string().trim().optional().nullable(),
    address: z.string().trim().optional().nullable(),
    phone: z.string().trim().min(1, "Cần có số điện thoại"),
    city: z.string().trim().optional().nullable()
  })
  .refine((row) => row.name || row.companyHead, {
    message: "Cần có tên công ty hoặc tên người đứng đầu công ty"
  });

const headerMap: Record<string, keyof z.infer<typeof importRowSchema>> = {
  tencongty: "name",
  congty: "name",
  tendonvi: "name",
  tendoanhnghiep: "name",
  name: "name",
  company: "name",
  companyname: "name",
  businessname: "name",
  organization: "name",
  organizationname: "name",
  tennguoidungdaucongty: "companyHead",
  nguoidungdaucongty: "companyHead",
  nguoidungdau: "companyHead",
  nguoidaidien: "companyHead",
  daidien: "companyHead",
  giamdoc: "companyHead",
  chudoanhnghiep: "companyHead",
  owner: "companyHead",
  representative: "companyHead",
  director: "companyHead",
  legalrepresentative: "companyHead",
  diadiem: "address",
  diachi: "address",
  diachicongty: "address",
  truso: "address",
  location: "address",
  address: "address",
  sodienthoai: "phone",
  dienthoai: "phone",
  sdt: "phone",
  hotline: "phone",
  phone: "phone",
  phonenumber: "phone",
  mobile: "phone",
  thanhpho: "city",
  thanhphopho: "city",
  tinhthanh: "city",
  tinhthanhpho: "city",
  city: "city",
  province: "city"
};

const normalizeHeader = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[đĐ]/g, "d")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/g, "");

const cleanText = (value: unknown) => {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
};

const cleanPhone = (value: unknown) => {
  const text = typeof value === "number" ? String(Math.trunc(value)) : cleanText(value);
  if (!text) return null;

  const normalized = text.replace(/^'/, "").replace(/[\s.()+-]/g, "");
  return /^\d{9}$/.test(normalized) ? `0${normalized}` : normalized;
};

const mapRecord = (record: Record<string, unknown>) => {
  const output: Record<string, unknown> = {};

  for (const [header, value] of Object.entries(record)) {
    const field = headerMap[normalizeHeader(header)];
    if (!field) continue;
    output[field] = field === "phone" ? cleanPhone(value) : cleanText(value);
  }

  return importRowSchema.parse(output);
};

export const importCustomersFromExcel = async (file: Express.Multer.File, createdBy: string, importName?: string) => {
  const workbookRows = await readXlsxFile(file.buffer);

  if (!workbookRows.length) {
    throw new Error("Tệp bảng tính không có trang dữ liệu");
  }

  const headers = workbookRows[0].map((cell) => String(cell ?? ""));

  const rows: Array<{ rowNumber: number; record: Record<string, unknown> }> = [];
  workbookRows.slice(1).forEach((row, index) => {
    if (!row.some((cell) => String(cell ?? "").trim().length > 0)) return;

    const record: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      record[header] = row[index] ?? "";
    });
    rows.push({ rowNumber: index + 2, record });
  });

  let successRows = 0;
  let duplicateRows = 0;
  let failedRows = 0;
  const errors: Array<{ row: number; message: string }> = [];
  const displayName = importName?.trim() || file.originalname;

  const history = await prisma.importHistory.create({
    data: {
      importName: displayName,
      filename: file.originalname,
      totalRows: rows.length,
      successRows: 0,
      duplicateRows: 0,
      failedRows: 0,
      createdBy
    }
  });

  for (const { rowNumber, record } of rows) {
    try {
      const row = mapRecord(record);
      const existingCustomer = await prisma.customer.findFirst({
        where: { phone: row.phone }
      });

      if (existingCustomer) {
        duplicateRows += 1;
        continue;
      }

      await prisma.customer.create({
        data: {
          name: row.name || row.companyHead || row.phone,
          companyHead: row.companyHead || null,
          phone: row.phone,
          address: row.address || null,
          city: row.city || null,
          importId: history.id
        }
      });
      successRows += 1;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        duplicateRows += 1;
        continue;
      }

      failedRows += 1;
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : "Lỗi nhập dữ liệu không xác định"
      });
    }
  }

  const updatedHistory = await prisma.importHistory.update({
    where: { id: history.id },
    data: { successRows, duplicateRows, failedRows }
  });

  return {
    history: updatedHistory,
    totalRows: rows.length,
    successRows,
    duplicateRows,
    failedRows,
    errors: errors.slice(0, 20)
  };
};
