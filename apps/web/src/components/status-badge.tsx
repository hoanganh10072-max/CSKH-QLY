import type { CustomerStatus, TaskStatus, UserStatus } from "@/lib/types";
import { Badge } from "@/components/UI/Badge";

const statusLabel: Record<CustomerStatus | TaskStatus | UserStatus, string> = {
  NEW: "Mới",
  CONTACTED: "Đã liên hệ",
  FOLLOW_UP: "Cần gọi lại",
  INTERESTED: "Quan tâm",
  CUSTOMER: "Đã mua",
  NOT_INTERESTED: "Không quan tâm",
  TODO: "Cần làm",
  DONE: "Hoàn tất",
  CANCELLED: "Đã hủy",
  ACTIVE: "Hoạt động",
  INACTIVE: "Tạm khóa"
};

const tone: Record<string, "cyan" | "green" | "amber" | "rose" | "violet" | "slate"> = {
  NEW: "cyan",
  CONTACTED: "violet",
  FOLLOW_UP: "amber",
  INTERESTED: "green",
  CUSTOMER: "green",
  NOT_INTERESTED: "rose",
  TODO: "amber",
  DONE: "green",
  CANCELLED: "slate",
  ACTIVE: "green",
  INACTIVE: "slate"
};

export function StatusBadge({ status }: { status: CustomerStatus | TaskStatus | UserStatus }) {
  return <Badge tone={tone[status]}>{statusLabel[status]}</Badge>;
}
