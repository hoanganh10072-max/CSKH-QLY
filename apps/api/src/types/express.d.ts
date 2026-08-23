import type { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        username?: string | null;
        email: string;
        phone?: string | null;
        employeeCode?: string | null;
        department?: string | null;
        positionTitle?: string | null;
        dateOfBirth?: Date | null;
        gender?: string | null;
        citizenId?: string | null;
        citizenIssuedDate?: Date | null;
        citizenIssuedPlace?: string | null;
        currentAddress?: string | null;
        hometown?: string | null;
        emergencyContactName?: string | null;
        emergencyContactPhone?: string | null;
        startDate?: Date | null;
        personalNote?: string | null;
        bankAccountNumber?: string | null;
        bankName?: string | null;
        bankAccountHolder?: string | null;
        role: UserRole;
        status: string;
      };
    }
  }
}

export {};
