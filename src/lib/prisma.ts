import { PrismaClient } from "@/generated/prisma";

const globalForPrisma = globalThis as unknown as {
  prismaFresh: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prismaFresh ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaFresh = prisma;
}
