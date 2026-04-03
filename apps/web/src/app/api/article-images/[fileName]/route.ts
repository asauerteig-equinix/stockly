import { NextResponse } from "next/server";

import { articlePlaceholderImage } from "@/lib/article-images";
import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { apiError } from "@/server/permissions";

export async function GET(_: Request, { params }: { params: Promise<{ fileName: string }> }) {
  try {
    const { fileName } = await params;
    const image = await prisma.articleImage.findUnique({
      where: {
        fileName: decodeURIComponent(fileName)
      },
      select: {
        data: true,
        mimeType: true
      }
    });

    if (!image) {
      return new NextResponse("Bild nicht gefunden.", {
        status: 404
      });
    }

    return new NextResponse(Buffer.from(image.data), {
      headers: {
        "Content-Type": image.mimeType,
        "Cache-Control": "public, max-age=604800, immutable"
      }
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ fileName: string }> }) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return apiError(new Error("Nicht angemeldet."), 401);
    }

    const { fileName } = await params;
    const decodedFileName = decodeURIComponent(fileName);
    const imageUrl = `/api/article-images/${encodeURIComponent(decodedFileName)}`;

    await prisma.$transaction(async (tx) => {
      await tx.articleImage.deleteMany({
        where: {
          fileName: decodedFileName
        }
      });

      await tx.article.updateMany({
        where: {
          imageUrl
        },
        data: {
          imageUrl: articlePlaceholderImage
        }
      });

      await tx.purchaseOrderItem.updateMany({
        where: {
          imageUrlSnapshot: imageUrl
        },
        data: {
          imageUrlSnapshot: articlePlaceholderImage
        }
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
