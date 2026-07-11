import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { ROLE_HOME } from "@/components/layout/nav-config";

export default async function RootPage() {
  const user = await getCurrentUser();
  redirect(ROLE_HOME[user.role]);
}
