import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertMasterAdmin, apiError } from "@/server/permissions";
import { createAdminSchema } from "@/server/validation";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return apiError(new Error("Nicht angemeldet."), 401);
    }

    assertMasterAdmin(user);

    const body = createAdminSchema.parse(await request.json());
    const passwordHash = await bcrypt.hash(body.password, 10);

    const createdUser = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email.toLowerCase(),
        passwordHash,
        role: body.role,
        assignedLocations: {
          createMany: {
            data: body.locationIds.map((locationId) => ({ locationId }))
          }
        }
      }
    });

    return NextResponse.json({ user: createdUser });
  } catch (error) {
    return apiError(error);
  }
}
