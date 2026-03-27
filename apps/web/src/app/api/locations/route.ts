import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertMasterAdmin, apiError } from "@/server/permissions";
import { locationSchema } from "@/server/validation";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return apiError(new Error("Nicht angemeldet."), 401);
    }

    const locations = await prisma.location.findMany({
      where:
        user.role === "MASTER_ADMIN"
          ? undefined
          : {
              id: {
                in: user.assignedLocationIds
              }
            },
      include: {
        settings: true
      },
      orderBy: {
        name: "asc"
      }
    });

    return NextResponse.json({ locations });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return apiError(new Error("Nicht angemeldet."), 401);
    }

    assertMasterAdmin(user);

    const body = locationSchema.parse(await request.json());
    const kioskPinHash = await bcrypt.hash(body.kioskPin, 10);

    const location = await prisma.location.create({
      data: {
        name: body.name,
        code: body.code.toUpperCase(),
        description: body.description ?? null,
        kioskPinHash,
        settings: {
          create: {
            agingWarningDays: body.agingWarningDays,
            allowNegativeStock: body.allowNegativeStock
          }
        }
      }
    });

    return NextResponse.json({ location });
  } catch (error) {
    return apiError(error);
  }
}
