import { NextResponse } from "next/server";

import { getKioskContext } from "@/server/auth";

export async function GET() {
  const kiosk = await getKioskContext();
  return NextResponse.json({ kiosk });
}
