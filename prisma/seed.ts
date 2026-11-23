import { PrismaClient, Role } from "../src/generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  const customerPasswordHash = await bcrypt.hash("customer123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@mediatama.test" },
    update: {
      name: "System Administrator",
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
    },
    create: {
      name: "System Administrator",
      email: "admin@mediatama.test",
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
    },
  });

  const customer1 = await prisma.user.upsert({
    where: { email: "customer1@mediatama.test" },
    update: {
      name: "Customer One",
      passwordHash: customerPasswordHash,
      role: Role.CUSTOMER,
    },
    create: {
      name: "Customer One",
      email: "customer1@mediatama.test",
      passwordHash: customerPasswordHash,
      role: Role.CUSTOMER,
    },
  });

  const customer2 = await prisma.user.upsert({
    where: { email: "customer2@mediatama.test" },
    update: {
      name: "Customer Two",
      passwordHash: customerPasswordHash,
      role: Role.CUSTOMER,
    },
    create: {
      name: "Customer Two",
      email: "customer2@mediatama.test",
      passwordHash: customerPasswordHash,
      role: Role.CUSTOMER,
    },
  });

  console.log("Seeded users:", {
    admin: admin.email,
    customer1: customer1.email,
    customer2: customer2.email,
  });
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
