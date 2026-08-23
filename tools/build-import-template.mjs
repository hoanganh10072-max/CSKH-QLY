import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const sampleDir = path.join(rootDir, "sample-data");
const workDir = path.join(rootDir, ".artifact-work");

await fs.mkdir(sampleDir, { recursive: true });
await fs.mkdir(workDir, { recursive: true });

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Import Template");
sheet.showGridLines = false;
sheet.freezePanes.freezeRows(1);
sheet.getRange("B1:B20").format.numberFormat = "0000000000";

sheet.getRange("A1:E6").values = [
  ["Tên khách", "Số điện thoại", "Email", "Địa chỉ", "Nguồn"],
  ["Nguyễn Văn An", 912345678, "nguyenvanan@example.com", "Quận 1, TP.HCM", "Facebook"],
  ["Trần Thị Bình", 987654321, "tranthibinh@example.com", "Quận 3, TP.HCM", "Website"],
  ["Lê Minh Châu", 901122334, "leminhchau@example.com", "Thủ Đức, TP.HCM", "Zalo"],
  ["Phạm Quốc Dũng", 933445566, "phamquocdung@example.com", "Biên Hòa, Đồng Nai", "Referral"],
  ["Võ Thu Hà", 977889900, "vothuha@example.com", "Dĩ An, Bình Dương", "Event"]
];

sheet.getRange("A1:E1").format = {
  fill: "#087F8C",
  font: { bold: true, color: "#FFFFFF" },
  wrapText: true
};
sheet.getRange("A1:E6").format.borders = { preset: "all", style: "thin", color: "#D7DEE7" };
sheet.getRange("A2:E6").format = { font: { color: "#172026" } };
sheet.getRange("A1:A20").format.columnWidth = 24;
sheet.getRange("B1:B20").format.columnWidth = 18;
sheet.getRange("C1:C20").format.columnWidth = 30;
sheet.getRange("D1:D20").format.columnWidth = 28;
sheet.getRange("E1:E20").format.columnWidth = 18;
sheet.getRange("A1:E6").format.rowHeight = 24;

const table = sheet.tables.add("A1:E6", true, "CustomerImportTemplate");
table.style = "TableStyleMedium2";
table.showFilterButton = true;

const guide = workbook.worksheets.add("Hướng dẫn");
guide.showGridLines = false;
guide.getRange("A1:D1").merge();
guide.getRange("A1:D1").values = [["Hướng dẫn import data khách hàng"]];
guide.getRange("A1:D1").format = {
  fill: "#172026",
  font: { bold: true, color: "#FFFFFF", size: 14 }
};
guide.getRange("A3:D8").values = [
  ["Cột", "Bắt buộc", "Ghi chú", "Ví dụ"],
  ["Tên khách", "Có", "Tên khách hàng hoặc lead", "Nguyễn Văn An"],
  ["Số điện thoại", "Có nếu thiếu Email", "Hệ thống dùng để chống trùng", "0912345678"],
  ["Email", "Có nếu thiếu Số điện thoại", "Hệ thống dùng để chống trùng", "lead@example.com"],
  ["Địa chỉ", "Không", "Thông tin bổ sung", "Quận 1, TP.HCM"],
  ["Nguồn", "Không", "Kênh phát sinh lead", "Facebook"]
];
guide.getRange("A3:D3").format = {
  fill: "#E9F6F8",
  font: { bold: true, color: "#172026" }
};
guide.getRange("A3:D8").format.borders = { preset: "all", style: "thin", color: "#D7DEE7" };
guide.getRange("A1:D12").format.wrapText = true;
guide.getRange("A1:A20").format.columnWidth = 20;
guide.getRange("B1:B20").format.columnWidth = 20;
guide.getRange("C1:C20").format.columnWidth = 38;
guide.getRange("D1:D20").format.columnWidth = 24;

const inspect = await workbook.inspect({
  kind: "table",
  range: "Import Template!A1:E6",
  include: "values,formulas",
  tableMaxRows: 8,
  tableMaxCols: 6,
  maxChars: 4000
});
console.log(inspect.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 50 },
  summary: "final formula error scan",
  maxChars: 2000
});
console.log(errors.ndjson);

const preview = await workbook.render({
  sheetName: "Import Template",
  range: "A1:E8",
  scale: 2,
  format: "png"
});
await fs.writeFile(path.join(workDir, "customer-import-template-preview.png"), new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(path.join(sampleDir, "customer-import-template.xlsx"));
