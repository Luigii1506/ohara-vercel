import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getTikTokGiftCatalog } from "@/lib/live-overlay/giftCatalog";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionToken = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!sessionToken?.email || sessionToken.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const gifts = await getTikTokGiftCatalog();
    return NextResponse.json({ ok: true, gifts });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 502 });
  }
}
