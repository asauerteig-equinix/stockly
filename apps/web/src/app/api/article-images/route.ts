import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { buildArticleImageUrl } from "@/lib/article-images";
import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { apiError } from "@/server/permissions";

const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);

function getExtension(file: File) {
  const fromType = file.type.split("/")[1];
  if (fromType === "jpeg") {
    return ".jpg";
  }

  if (fromType === "svg+xml") {
    return ".svg";
  }

  return fromType ? `.${fromType}` : "";
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return apiError(new Error("Nicht angemeldet."), 401);
    }

    const images = await prisma.articleImage.findMany({
      orderBy: [{ createdAt: "asc" }, { originalName: "asc" }],
      select: {
        fileName: true,
        originalName: true
      }
    });

    return NextResponse.json({
      images: images.map((image) => ({
        fileName: image.fileName,
        name: image.originalName,
        url: buildArticleImageUrl(image.fileName)
      }))
    });
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

    const formData = await request.formData();
    const file = formData.get("image");

    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Bitte ein Bild auswaehlen.");
    }

    if (!allowedImageTypes.has(file.type)) {
      throw new Error("Nur PNG, JPG, WEBP, GIF oder SVG sind erlaubt.");
    }

    const fileName = `${randomUUID()}${getExtension(file)}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const image = await prisma.articleImage.create({
      data: {
        fileName,
        originalName: file.name,
        mimeType: file.type,
        data: bytes
      },
      select: {
        fileName: true,
        originalName: true
      }
    });

    return NextResponse.json({
      image: {
        fileName: image.fileName,
        name: image.originalName,
        url: buildArticleImageUrl(image.fileName)
      }
    });
  } catch (error) {
    return apiError(error);
  }
}
