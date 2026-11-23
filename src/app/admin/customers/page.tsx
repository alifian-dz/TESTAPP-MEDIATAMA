import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CustomersClient, CustomerRow } from "./customers-client";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  await requireAdminPage();

  const customers = await prisma.user.findMany({
    where: { role: "CUSTOMER", deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          accessRequests: true,
          videoPermissions: true,
        },
      },
    },
  });

  const serialized: CustomerRow[] = customers.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    role: "CUSTOMER",
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    _count: c._count,
  }));

  return <CustomersClient initialCustomers={serialized} />;
}
