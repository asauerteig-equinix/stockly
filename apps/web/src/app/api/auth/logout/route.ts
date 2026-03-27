import { NextResponse } from "next/server";

import { destroyAdminSession } from "@/server/auth";

export async function POST() {
  await destroyAdminSession();
  return NextResponse.json({ success: true });
}
