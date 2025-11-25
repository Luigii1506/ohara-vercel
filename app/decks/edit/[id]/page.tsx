import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";
import DeckBuilder from "@/components/deckbuilder/EditDeckBuilder";
import { redirect } from "next/navigation";

interface EditDeckPageProps {
  params: { id: string };
}

export default async function EditDeckPage({ params }: EditDeckPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/unauthorized");
  }

  const deckId = Number(params.id);
  if (Number.isNaN(deckId)) {
    redirect("/unauthorized");
  }

  const deck = await prisma.deck.findUnique({
    where: { id: deckId },
    select: { id: true, userId: true },
  });

  if (!deck || (deck.userId !== Number(session.user.id) && session.user.role !== "ADMIN")) {
    redirect("/unauthorized");
  }

  return <DeckBuilder />;
}
