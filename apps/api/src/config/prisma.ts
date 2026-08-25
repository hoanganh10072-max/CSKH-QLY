import "dotenv/config";
import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const createPrismaClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

const prismaStorage = new AsyncLocalStorage<PrismaClient>();
let fallbackPrisma: PrismaClient | null = null;

const getFallbackPrisma = () => {
  fallbackPrisma ??= createPrismaClient();
  return fallbackPrisma;
};

export const runWithRequestPrisma = async <T>(callback: () => Promise<T> | T) => {
  const requestPrisma = createPrismaClient();

  return prismaStorage.run(requestPrisma, async () => {
    try {
      return await callback();
    } finally {
      await requestPrisma.$disconnect().catch(() => undefined);
    }
  });
};

export const disconnectPrisma = async () => {
  if (!fallbackPrisma) return;
  await fallbackPrisma.$disconnect();
  fallbackPrisma = null;
};

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = prismaStorage.getStore() ?? getFallbackPrisma();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  }
});
