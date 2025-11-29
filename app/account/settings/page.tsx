import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";
import SettingsClient from "./settings-client";

export default async function AccountSettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = Number(session.user.id);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      role: true,
      password: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  const accounts = await prisma.account.findMany({
    where: { userId },
    select: { provider: true },
  });

  return (
    <SettingsClient
      user={{
        name: user.name ?? "",
        email: user.email,
        role: user.role,
        hasPassword: Boolean(user.password),
      }}
      providers={accounts.map((account) => account.provider)}
    />
  );
}
