import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

let prismaClient: PrismaClient | undefined;

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

function instantiatePrisma() {
  resolveDatabaseUrl();

  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }

  return client;
}

export function getPrisma(): PrismaClient {
  if (prismaClient) {
    return prismaClient;
  }

  if (globalForPrisma.prisma) {
    prismaClient = globalForPrisma.prisma;
    return prismaClient;
  }

  prismaClient = instantiatePrisma();
  return prismaClient;
}

const prismaProxy = new Proxy(
  {},
  {
    get(_target, prop, receiver) {
      const client = getPrisma() as unknown as Record<PropertyKey, unknown>;
      const value = Reflect.get(client, prop, receiver);

      if (typeof value === "function") {
        return value.bind(client);
      }

      return value;
    },
  }
) as PrismaClient;

export const prisma = prismaProxy;
export default prismaProxy;
