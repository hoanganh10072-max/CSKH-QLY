import { CustomerStatus, UserRole } from "@prisma/client";
import { prisma } from "../src/config/prisma.js";
import { hashPassword } from "../src/lib/password.js";

const main = async () => {
  const adminPassword = await hashPassword("1");
  const staffPassword = await hashPassword("1");

  const admin = await prisma.user.upsert({
    where: { email: "admin@cskh.local" },
    update: {
      name: "Quản trị viên CSKH",
      username: "admin",
      passwordHash: adminPassword,
      role: UserRole.ADMIN
    },
    create: {
      name: "Quản trị viên CSKH",
      username: "admin",
      email: "admin@cskh.local",
      phone: "0900000000",
      passwordHash: adminPassword,
      role: UserRole.ADMIN
    }
  });

  const staff = await prisma.user.upsert({
    where: { email: "staff@cskh.local" },
    update: {
      name: "Nhân viên CSKH",
      username: "NV",
      passwordHash: staffPassword,
      role: UserRole.STAFF
    },
    create: {
      name: "Nhân viên CSKH",
      username: "NV",
      email: "staff@cskh.local",
      phone: "0900000001",
      passwordHash: staffPassword,
      role: UserRole.STAFF
    }
  });

  await prisma.customer.upsert({
    where: { phone: "0912345678" },
    update: {},
    create: {
      name: "Nguyen Van A",
      phone: "0912345678",
      email: "nguyenvana@example.com",
      source: "Facebook",
      address: "Quan 1, TP.HCM",
      status: CustomerStatus.NEW
    }
  });

  await prisma.customer.upsert({
    where: { phone: "0987654321" },
    update: {},
    create: {
      name: "Tran Thi B",
      phone: "0987654321",
      email: "tranthib@example.com",
      source: "Website",
      address: "Quan 3, TP.HCM",
      status: CustomerStatus.CONTACTED,
      ownerId: staff.id
    }
  });

  console.log(`Đã tạo/cập nhật tài khoản test: admin / 1 và NV / 1`);
};

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
