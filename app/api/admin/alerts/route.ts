import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma, AlertThresholdType } from "@prisma/client";
import { alertInclude, serializeAlert, validateThreshold } from "./utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get("search");
    const includeLogs =
      req.nextUrl.searchParams.get("includeLogs") === "true";
    const isActiveParam = req.nextUrl.searchParams.get("isActive");
    const cardIdParam = req.nextUrl.searchParams.get("cardId");

    const where: Prisma.CardPriceAlertWhereInput = {};

    if (search) {
      where.card = {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { code: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    if (isActiveParam !== null) {
      where.isActive = isActiveParam === "true";
    }

    if (cardIdParam) {
      const parsed = Number(cardIdParam);
      if (!Number.isNaN(parsed)) {
        where.cardId = parsed;
      }
    }

    const alerts = await prisma.cardPriceAlert.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: alertInclude,
    });

    let recentLogs: any[] = [];
    if (includeLogs) {
      const logs = await prisma.cardPriceAlertLog.findMany({
        orderBy: { triggeredAt: "desc" },
        take: 12,
        include: {
          card: {
            select: {
              id: true,
              name: true,
              code: true,
              priceCurrency: true,
            },
          },
          alert: {
            select: {
              id: true,
              thresholdType: true,
              notificationMethod: true,
            },
          },
        },
      });
      recentLogs = logs.map((log) => ({
        id: log.id,
        alertId: log.alertId,
        card: log.card,
        alert: log.alert,
        price: Number(log.price),
        priceType: log.priceType,
        triggeredAt: log.triggeredAt,
      }));
    }

    return NextResponse.json({
      alerts: alerts.map(serializeAlert),
      recentLogs,
    });
  } catch (error) {
    console.error("Failed to load alerts", error);
    return NextResponse.json(
      { error: "Failed to load alerts" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cardId = Number(body.cardId);
    if (!Number.isInteger(cardId) || cardId <= 0) {
      return NextResponse.json(
        { error: "Valid cardId is required" },
        { status: 400 }
      );
    }

    const { thresholdType, notificationMethod } = validateThreshold(body);

    const data: Prisma.CardPriceAlertCreateInput = {
      card: { connect: { id: cardId } },
      thresholdType,
      notificationMethod,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
    };

    if (thresholdType === AlertThresholdType.PERCENT_CHANGE) {
      const percentChange = Number(body.percentChange);
      if (!Number.isFinite(percentChange)) {
        return NextResponse.json(
          { error: "percentChange is required for percent alerts" },
          { status: 400 }
        );
      }
      data.percentChange = percentChange;
      data.percentWindowHours = Number.isFinite(
        Number(body.percentWindowHours)
      )
        ? Number(body.percentWindowHours)
        : 24;
      data.thresholdValue = null;
    } else {
      const thresholdValue = Number(body.thresholdValue);
      if (!Number.isFinite(thresholdValue)) {
        return NextResponse.json(
          { error: "thresholdValue is required for value alerts" },
          { status: 400 }
        );
      }
      data.thresholdValue = new Prisma.Decimal(thresholdValue);
      data.percentChange = null;
      data.percentWindowHours = null;
    }

    const created = await prisma.cardPriceAlert.create({
      data,
      include: alertInclude,
    });

    return NextResponse.json(serializeAlert(created), { status: 201 });
  } catch (error) {
    console.error("Failed to create alert", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to create alert" },
      { status: 500 }
    );
  }
}
