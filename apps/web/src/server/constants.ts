export const ADMIN_SESSION_COOKIE = "stockly_admin_session";
export const KIOSK_SESSION_COOKIE = "stockly_kiosk_session";
export const ADMIN_SESSION_DURATION_DAYS = 14;
export const KIOSK_SESSION_DURATION_DAYS = 365;

export const usageReasonOptions = ["crossconnect", "smarthand", "custom order", "project"] as const;

export type UsageReasonOption = (typeof usageReasonOptions)[number];
