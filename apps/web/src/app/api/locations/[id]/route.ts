import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertMasterAdmin, apiError } from "@/server/permissions";

const updateLocationSchema = z.object({
  name: z.string().min(2).optional(),
  code: z.string().min(2).max(12).regex(/^[A-Z0-9_-]+$/).optional(),
  description: z.string().max(300).optional().nullable(),
  kioskPin: z.string().min(4).max(20).optional(),
  agingWarningDays: z.coerce.number().int().min(1).max(365).optional(),
  allowNegativeStock: z.coerce.boolean().optional()
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return apiError(new Error("Nicht angemeldet."), 401);
    }

    assertMasterAdmin(user);

    const { id } = await params;
    const body = updateLocationSchema.parse(await request.json());

    const location = await prisma.location.update({
      where: { id },
      data: {
        name: body.name,
        code: body.code?.toUpperCase(),
        description: body.description,
        kioskPinHash: body.kioskPin ? await bcrypt.hash(body.kioskPin, 10) : undefined,
        settings: {
          upsert: {
            create: {
              agingWarningDays: body.agingWarningDays ?? 30,
              allowNegativeStock: body.allowNegativeStock ?? false
            },
            update: {
              agingWarningDays: body.agingWarningDays,
              allowNegativeStock: body.allowNegativeStock
            }
          }
        }
      },
      include: {
        settings: true
      }
    });

    return NextResponse.json({ location });
  } catch (error) {
    return apiError(error);
  }
}
