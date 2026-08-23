import { Prisma } from "@prisma/client";
import readXlsxFile, { readSheetNames } from "read-excel-file/node";
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

type SpreadsheetSource = {
  buffer: Buffer;
  originalname: string;
};

type ImportValidationError = {
  sheet?: string;
  row: number;
  message: string;
};

type ParsedImportRow = {
  sheetName: string;
  rowNumber: number;
  row: z.infer<typeof importRowSchema>;
};

const collectRowsFromWorkbook = async (source: SpreadsheetSource) => {
  const sheetNames = await readSheetNames(source.buffer);

  if (!sheetNames.length) {
    throw new Error("Tệp bảng tính không có trang dữ liệu");
  }

  const rows: Array<{ sheetName: string; rowNumber: number; record: Record<string, unknown> }> = [];

  for (const sheetName of sheetNames) {
    const workbookRows = await readXlsxFile(source.buffer, { sheet: sheetName });
    if (!workbookRows.length) continue;

    const headers = workbookRows[0].map((cell) => String(cell ?? ""));

    workbookRows.slice(1).forEach((row, index) => {
      if (!row.some((cell) => String(cell ?? "").trim().length > 0)) return;

      const record: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        if (!header) return;
        record[header] = row[index] ?? "";
      });
      rows.push({ sheetName, rowNumber: index + 2, record });
    });
  }

  if (!rows.length) {
    throw new Error("Tệp bảng tính không có dòng dữ liệu");
  }

  return rows;
};

const parseImportRows = async (source: SpreadsheetSource) => {
  const rows = await collectRowsFromWorkbook(source);
  const parsedRows: ParsedImportRow[] = [];
  const errors: ImportValidationError[] = [];

  for (const { sheetName, rowNumber, record } of rows) {
    try {
      parsedRows.push({
        sheetName,
        rowNumber,
        row: mapRecord(record)
      });
    } catch (error) {
      errors.push({
        sheet: sheetName,
        row: rowNumber,
        message: error instanceof Error ? error.message : "Lỗi nhập dữ liệu không xác định"
      });
    }
  }

  return { rows, parsedRows, errors };
};

const findExistingPhones = async (phones: string[]) => {
  const existingPhones = new Set<string>();
  const chunkSize = 1000;

  for (let index = 0; index < phones.length; index += chunkSize) {
    const chunk = phones.slice(index, index + chunkSize);
    const customers = await prisma.customer.findMany({
      where: { phone: { in: chunk } },
      select: { phone: true }
    });

    customers.forEach((customer) => {
      if (customer.phone) existingPhones.add(customer.phone);
    });
  }

  return existingPhones;
};

export const previewCustomersFromSpreadsheet = async (source: SpreadsheetSource) => {
  const { rows, parsedRows, errors } = await parseImportRows(source);
  const seenPhones = new Set<string>();
  const uniqueRows: ParsedImportRow[] = [];
  let duplicateInFileRows = 0;

  for (const parsedRow of parsedRows) {
    if (seenPhones.has(parsedRow.row.phone)) {
      duplicateInFileRows += 1;
      continue;
    }

    seenPhones.add(parsedRow.row.phone);
    uniqueRows.push(parsedRow);
  }

  const existingPhones = await findExistingPhones(uniqueRows.map((item) => item.row.phone));
  const duplicateInSystemRows = uniqueRows.filter((item) => existingPhones.has(item.row.phone)).length;
  const readyRows = uniqueRows.length - duplicateInSystemRows;

  return {
    totalRows: rows.length,
    validRows: parsedRows.length,
    duplicateRows: duplicateInFileRows + duplicateInSystemRows,
    duplicateInFileRows,
    duplicateInSystemRows,
    readyRows,
    failedRows: errors.length,
    errors: errors.slice(0, 20)
  };
};

export const previewCustomersFromExcel = async (file: Express.Multer.File) =>
  previewCustomersFromSpreadsheet({
    buffer: file.buffer,
    originalname: file.originalname
  });

export const importCustomersFromSpreadsheet = async (source: SpreadsheetSource, createdBy: string, importName?: string) => {
  const { rows, parsedRows, errors } = await parseImportRows(source);

  let successRows = 0;
  let duplicateRows = 0;
  let failedRows = errors.length;
  const seenPhones = new Set<string>();
  const displayName = importName?.trim() || source.originalname;

  const history = await prisma.importHistory.create({
    data: {
      importName: displayName,
      filename: source.originalname,
      totalRows: rows.length,
      successRows: 0,
      duplicateRows: 0,
      failedRows: 0,
      createdBy
    }
  });

  for (const { sheetName, rowNumber, row } of parsedRows) {
    try {
      if (seenPhones.has(row.phone)) {
        duplicateRows += 1;
        continue;
      }

      seenPhones.add(row.phone);

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
        sheet: sheetName,
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

export const importCustomersFromExcel = async (file: Express.Multer.File, createdBy: string, importName?: string) =>
  importCustomersFromSpreadsheet(
    {
      buffer: file.buffer,
      originalname: file.originalname
    },
    createdBy,
    importName
  );
