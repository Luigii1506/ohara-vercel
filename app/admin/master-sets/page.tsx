export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import AdminMasterSetsClient from "./AdminMasterSetsClient";

export default async function AdminMasterSetsPage() {
  const auth = await getAuthenticatedUser();
  if (!auth.success || auth.user?.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  return <AdminMasterSetsClient />;
}
