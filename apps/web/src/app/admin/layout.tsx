import { AdminShell } from "@/components/layout/admin-shell";
import { requireUser } from "@/server/auth";

export default async function AdminLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireUser();

  return <AdminShell user={user}>{children}</AdminShell>;
}
