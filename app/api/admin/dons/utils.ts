import prisma from "@/lib/prisma";
import { DON_CATEGORY } from "@/helpers/constants";

export { DON_CATEGORY };

export const includeDonRelations = {
  sets: {
    include: {
      set: true,
    },
  },
};

export const sanitizeOptionalString = (value?: string | null) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export const parseSetIds = (input: unknown): number[] => {
  if (!Array.isArray(input)) return [];
  return input
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
};

export const findDonById = async (id: number) => {
  if (!Number.isInteger(id)) return null;
  return prisma.card.findUnique({
    where: { id },
    include: includeDonRelations,
  });
};
