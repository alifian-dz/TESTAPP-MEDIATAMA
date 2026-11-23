import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { AuthError, requireAdmin } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await context.params;

    const existing = await prisma.user.findUnique({
      where: { id },
    });

    if (!existing || existing.role !== "CUSTOMER" || existing.deletedAt !== null) {
      return NextResponse.json(
        { error: "Customer not found." },
        { status: 404 }
      );
    }

    const body = (await request.json()) as {
      name?: string;
      email?: string;
      password?: string;
    };

    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password?.trim();

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required." },
        { status: 400 }
      );
    }

    if (email !== existing.email) {
      const emailTaken = await prisma.user.findUnique({ where: { email } });
      if (emailTaken) {
        return NextResponse.json(
          { error: "Another user is already using this email." },
          { status: 409 }
        );
      }
    }

    const updateData: {
      name: string;
      email: string;
      passwordHash?: string;
    } = {
      name,
      email,
    };

    if (password && password.length > 0) {
      if (password.length < 6) {
        return NextResponse.json(
          { error: "New password must be at least 6 characters." },
          { status: 400 }
        );
      }
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const customer = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ customer });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Update customer error:", error);
    return NextResponse.json(
      { error: "Failed to update customer." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await context.params;

    const existing = await prisma.user.findUnique({
      where: { id },
    });

    if (!existing || existing.role !== "CUSTOMER" || existing.deletedAt !== null) {
      return NextResponse.json(
        { error: "Customer not found." },
        { status: 404 }
      );
    }

    const now = new Date();

    // Soft delete customer, revoke any active permissions, and reject pending requests
    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: { deletedAt: now },
      }),
      prisma.videoPermission.updateMany({
        where: {
          userId: id,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        data: {
          revokedAt: now,
          expiresAt: now,
        },
      }),
      prisma.accessRequest.updateMany({
        where: {
          userId: id,
          status: "PENDING",
        },
        data: {
          status: "REJECTED",
          reviewedAt: now,
          note: "Customer account deactivated (soft deleted).",
        },
      }),
    ]);

    return NextResponse.json({ success: true, softDeleted: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Soft delete customer error:", error);
    return NextResponse.json(
      { error: "Failed to delete customer." },
      { status: 500 }
    );
  }
}
