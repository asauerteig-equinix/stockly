import crypto from "crypto";

import { Role, type User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getCookiePath } from "@/lib/base-path";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_DURATION_DAYS,
  KIOSK_SESSION_COOKIE,
  KIOSK_SESSION_DURATION_DAYS
} from "@/server/constants";
import { prisma } from "@/server/db";
import { env } from "@/server/env";

const cookiePath = getCookiePath();

export type AuthUser = Pick<User, "id" | "email" | "name" | "role"> & {
  assignedLocationIds: string[];
};

export type KioskContext = {
  deviceId: string;
  locationId: string;
  locationName: string;
  locationCode: string;
};

function signHash(input: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(input).digest("hex");
}

function issueToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function createAdminSession(userId: string) {
  const token = issueToken();
  const tokenHash = signHash(token, env.SESSION_SECRET);
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.adminSession.create({
    data: {
      userId,
      tokenHash,
      expiresAt
    }
  });

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    expires: expiresAt,
    path: cookiePath
  });
}

export async function destroyAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (token) {
    await prisma.adminSession.deleteMany({
      where: {
        tokenHash: signHash(token, env.SESSION_SECRET)
      }
    });
  }

  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    expires: new Date(0),
    path: cookiePath
  });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.adminSession.findUnique({
    where: {
      tokenHash: signHash(token, env.SESSION_SECRET)
    },
    include: {
      user: {
        include: {
          assignedLocations: true
        }
      }
    }
  });

  if (!session || session.expiresAt < new Date() || !session.user.isActive) {
    await destroyAdminSession();
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    assignedLocationIds: session.user.assignedLocations.map((assignment) => assignment.locationId)
  };
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export function isMasterAdmin(user: Pick<AuthUser, "role">) {
  return user.role === Role.MASTER_ADMIN;
}

export function canAccessLocation(user: AuthUser, locationId: string) {
  return isMasterAdmin(user) || user.assignedLocationIds.includes(locationId);
}

export async function createKioskSession(locationId: string, label: string) {
  const token = issueToken();
  const tokenHash = signHash(token, env.KIOSK_SECRET);
  const expiresAt = new Date(Date.now() + KIOSK_SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  const device = await prisma.kioskDevice.create({
    data: {
      locationId,
      label,
      tokenHash,
      lastSeenAt: new Date()
    }
  });

  const cookieStore = await cookies();
  cookieStore.set(KIOSK_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    expires: expiresAt,
    path: cookiePath
  });

  return device;
}

export async function getKioskContext(): Promise<KioskContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(KIOSK_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const device = await prisma.kioskDevice.findUnique({
    where: {
      tokenHash: signHash(token, env.KIOSK_SECRET)
    },
    include: {
      location: true
    }
  });

  if (!device || !device.isActive || !device.location.isActive) {
    await clearKioskSession();
    return null;
  }

  await prisma.kioskDevice.update({
    where: { id: device.id },
    data: {
      lastSeenAt: new Date()
    }
  });

  return {
    deviceId: device.id,
    locationId: device.locationId,
    locationName: device.location.name,
    locationCode: device.location.code
  };
}

export async function requireKioskContext() {
  const kiosk = await getKioskContext();

  if (!kiosk) {
    redirect("/kiosk");
  }

  return kiosk;
}

export async function clearKioskSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(KIOSK_SESSION_COOKIE)?.value;

  if (token) {
    await prisma.kioskDevice.updateMany({
      where: {
        tokenHash: signHash(token, env.KIOSK_SECRET)
      },
      data: {
        isActive: false
      }
    });
  }

  cookieStore.set(KIOSK_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    expires: new Date(0),
    path: cookiePath
  });
}
