export type UserRole = "ADMIN" | "STAFF";
export type UserStatus = "ACTIVE" | "INACTIVE";
export type CustomerStatus =
  | "NEW"
  | "CONTACTED"
  | "FOLLOW_UP"
  | "INTERESTED"
  | "CUSTOMER"
  | "NOT_INTERESTED";
export type TaskStatus = "TODO" | "DONE" | "CANCELLED";
export type ConsultationCallStatus = "NOT_REACHED" | "CALLED";
export type MessageStatus = "SENT" | "NOT_SENT";

export type SessionUser = {
  id: string;
  name: string;
  username?: string | null;
  email: string;
  phone?: string | null;
  employeeCode?: string | null;
  department?: string | null;
  positionTitle?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  citizenId?: string | null;
  citizenIssuedDate?: string | null;
  citizenIssuedPlace?: string | null;
  currentAddress?: string | null;
  hometown?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  startDate?: string | null;
  personalNote?: string | null;
  bankAccountNumber?: string | null;
  bankName?: string | null;
  bankAccountHolder?: string | null;
  role: UserRole;
  status: UserStatus;
};

export type Customer = {
  id: string;
  name: string;
  companyHead?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  source?: string | null;
  status: CustomerStatus;
  revenue?: string | number | null;
  ownerId?: string | null;
  receivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  owner?: Pick<SessionUser, "id" | "name" | "email"> | null;
  importHistory?: { id: string; importName?: string | null; filename: string } | null;
  interactions?: CustomerInteraction[];
};

export type CustomerInteraction = {
  id: string;
  note: string;
  result?: string | null;
  callStatus?: ConsultationCallStatus | null;
  messageStatus?: MessageStatus | null;
  noMessageReason?: string | null;
  callHistoryImage?: string | null;
  createdAt: string;
  user: { id: string; name: string };
};

export type CustomerDetail = Customer & {
  interactions: CustomerInteraction[];
  tasks: Task[];
  ownerships: Array<{
    id: string;
    status: "ACTIVE" | "RELEASED";
    assignedDate: string;
    releasedDate?: string | null;
    user: { id: string; name: string };
  }>;
};

export type Task = {
  id: string;
  customerId: string;
  userId: string;
  title: string;
  deadline: string;
  status: TaskStatus;
  customer?: Pick<Customer, "id" | "name" | "phone" | "status">;
  user?: Pick<SessionUser, "id" | "name" | "email">;
};

export const customerStatuses: Array<{ value: CustomerStatus; label: string }> = [
  { value: "NEW", label: "Mới" },
  { value: "CONTACTED", label: "Đã liên hệ" },
  { value: "FOLLOW_UP", label: "Cần gọi lại" },
  { value: "INTERESTED", label: "Quan tâm" },
  { value: "CUSTOMER", label: "Đã mua" },
  { value: "NOT_INTERESTED", label: "Không quan tâm" }
];

export const taskStatuses: Array<{ value: TaskStatus; label: string }> = [
  { value: "TODO", label: "Cần làm" },
  { value: "DONE", label: "Hoàn tất" },
  { value: "CANCELLED", label: "Đã hủy" }
];

export const roleLabels: Record<UserRole, string> = {
  ADMIN: "Quản trị viên",
  STAFF: "Nhân viên"
};
