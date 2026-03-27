import { NextResponse } from "next/server";

import { createAdminSession, verifyPassword } from "@/server/auth";
import { prisma } from "@/server/db";
import { apiError } from "@/server/permissions";
import { loginSchema } from "@/server/validation";

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());
    const user = await prisma.user.findUnique({
      where: {
        email: body.email.toLowerCase()
      }
    });

    if (!user || !user.isActive) {
      throw new Error("Ungueltige Zugangsdaten.");
    }

    const passwordMatches = await verifyPassword(body.password, user.passwordHash);

    if (!passwordMatches) {
      throw new Error("Ungueltige Zugangsdaten.");
    }

    await createAdminSession(user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    return apiError(error, 401);
  }
}
