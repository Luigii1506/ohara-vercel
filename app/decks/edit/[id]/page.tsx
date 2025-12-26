import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";
import DeckBuilder from "@/components/deckbuilder/EditDeckBuilder";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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

  if (
    !deck ||
    (deck.userId !== Number(session.user.id) && session.user.role !== "ADMIN")
  ) {
    redirect("/unauthorized");
  }

  return (
    <>
      <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 md:hidden">
        <Link
          href="/decks"
          className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/95 px-5 py-3 text-sm font-semibold text-slate-700 shadow-lg shadow-slate-900/10 backdrop-blur-sm transition-all active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver a decks</span>
        </Link>
      </div>
      <DeckBuilder />
    </>
  );
}
