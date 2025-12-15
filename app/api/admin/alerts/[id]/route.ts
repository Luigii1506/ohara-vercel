import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { alertInclude, serializeAlert, validateThreshold } from "../utils";

type RouteContext = {
  params: { id: string };
};

const parseId = (value: string) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Invalid alert id");
  }
  return id;
};

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const id = parseId(context.params.id);
    const alert = await prisma.cardPriceAlert.findUnique({
      where: { id },
      include: alertInclude,
    });

    if (!alert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    return NextResponse.json(serializeAlert(alert));
  } catch (error) {
    console.error("Failed to fetch alert", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to fetch alert" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const id = parseId(context.params.id);
    const body = await req.json();

    const data: Prisma.CardPriceAlertUpdateInput = {};

    if (body.cardId !== undefined) {
      const cardId = Number(body.cardId);
      if (!Number.isInteger(cardId) || cardId <= 0) {
        return NextResponse.json(
          { error: "cardId must be a positive integer" },
          { status: 400 }
        );
      }
      data.card = { connect: { id: cardId } };
    }

    const { thresholdType, notificationMethod } = validateThreshold(body);
    data.thresholdType = thresholdType;
    data.notificationMethod = notificationMethod;

    if (body.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }

    if (thresholdType === "PERCENT_CHANGE") {
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

    const updated = await prisma.cardPriceAlert.update({
      where: { id },
      data,
      include: alertInclude,
    });

    return NextResponse.json(serializeAlert(updated));
  } catch (error) {
    console.error("Failed to update alert", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to update alert" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const id = parseId(context.params.id);
    await prisma.cardPriceAlert.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete alert", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to delete alert" },
      { status: 500 }
    );
  }
}
