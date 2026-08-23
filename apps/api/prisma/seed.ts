import { UserRole, UserStatus } from "@prisma/client";
import { prisma } from "../src/config/prisma.js";
import { hashPassword } from "../src/lib/password.js";

const main = async () => {
  const adminPassword = await hashPassword("1007");

  await prisma.$transaction(async (tx) => {
    await tx.customerInteraction.deleteMany();
    await tx.customerOwnership.deleteMany();
    await tx.task.deleteMany();
    await tx.dailyWorkKpi.deleteMany();
    await tx.weeklyWorkSchedule.deleteMany();
    await tx.customer.deleteMany();
    await tx.importHistory.deleteMany();
    await tx.workKpiTarget.deleteMany();
    await tx.user.deleteMany();

    await tx.user.create({
      data: {
        email: "admin@mscilabs.local",
        phone: "0900000000",
        status: UserStatus.ACTIVE,
        deletedAt: null,
        passwordHash: adminPassword,
        role: UserRole.ADMIN,
        username: "admin",
        name: "Quản trị viên MSCILABS"
      }
    });
  });

  console.log("Đã xóa dữ liệu demo và tạo duy nhất tài khoản admin / 1007");
};

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
