import { redirect } from "next/navigation";

export default function LegacyOfflineEmployeesPage() {
  redirect("/employees/interns");
}
