import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { type AuthUser, canAccessLocation, isMasterAdmin } from "@/server/auth";

export function assertLocationAccess(user: AuthUser, locationId: string) {
  if (!canAccessLocation(user, locationId)) {
    throw new Error("Kein Zugriff auf diesen Standort.");
  }
}

export function assertMasterAdmin(user: AuthUser) {
  if (!isMasterAdmin(user)) {
    throw new Error("Nur Master Admin erlaubt.");
  }
}

export function getVisibleLocationFilter(user: AuthUser) {
  if (user.role === Role.MASTER_ADMIN) {
    return {};
  }

  return {
    id: {
      in: user.assignedLocationIds
    }
  };
}

export function getVisibleMovementFilter(user: AuthUser) {
  if (user.role === Role.MASTER_ADMIN) {
    return {};
  }

  return {
    locationId: {
      in: user.assignedLocationIds
    }
  };
}

export function apiError(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "Unbekannter Fehler";
  return NextResponse.json({ error: message }, { status });
}
