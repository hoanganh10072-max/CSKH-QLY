import { UserRole, UserStatus } from "@prisma/client";
import { prisma } from "../src/config/prisma.js";
import { hashPassword } from "../src/lib/password.js";

const main = async () => {
  const existingAdmin = await prisma.user.findFirst({
    where: {
      OR: [
        { username: "admin" },
        { email: "admin@mscilabs.local" }
      ]
    }
  });

  if (existingAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        name: "Quản trị viên MSCILABS",
        username: "admin",
        email: "admin@mscilabs.local",
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        deletedAt: null
      }
    });
    console.log("Tài khoản admin đã tồn tại, không đặt lại mật khẩu.");
    return;
  }

  await prisma.user.create({
    data: {
      name: "Quản trị viên MSCILABS",
      username: "admin",
      email: "admin@mscilabs.local",
      phone: "0900000000",
      passwordHash: await hashPassword("1007"),
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE
    }
  });

  console.log("Đã tạo tài khoản admin / 1007.");
};

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
