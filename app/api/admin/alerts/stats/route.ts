import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      activeAlerts,
      inactiveAlerts,
      alertsTriggered24h,
      unreadNotifications,
      lastTrigger,
    ] = await Promise.all([
      prisma.cardPriceAlert.count({ where: { isActive: true } }),
      prisma.cardPriceAlert.count({ where: { isActive: false } }),
      prisma.cardPriceAlertLog.count({
        where: { triggeredAt: { gte: since24h } },
      }),
      prisma.adminNotification.count({ where: { isRead: false } }),
      prisma.cardPriceAlertLog.findFirst({
        orderBy: { triggeredAt: "desc" },
        select: { triggeredAt: true },
      }),
    ]);

    return NextResponse.json({
      activeAlerts,
      inactiveAlerts,
      alertsTriggered24h,
      unreadNotifications,
      lastTriggerAt: lastTrigger?.triggeredAt ?? null,
    });
  } catch (error) {
    console.error("Failed to fetch alert stats", error);
    return NextResponse.json(
      { error: "Failed to fetch alert stats" },
      { status: 500 }
    );
  }
}
