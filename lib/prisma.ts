import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function resolveDatabaseUrl(): string {
  const primary = process.env.DATABASE_URL;
  if (primary && primary.trim().length > 0) {
    return primary;
  }

  const fallbacks = [
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_DATABASE_URL,
  ];

  for (const value of fallbacks) {
    if (value && value.trim().length > 0) {
      process.env.DATABASE_URL = value;
      return value;
    }
  }

  throw new Error(
    "DATABASE_URL is not defined. Please set DATABASE_URL or POSTGRES_PRISMA_URL in your environment."
  );
}

function createPrismaClient() {
  resolveDatabaseUrl();

  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

  return client;
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
