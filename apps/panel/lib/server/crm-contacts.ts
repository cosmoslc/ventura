// Muallif / Agent: Google Gemini
import { eq } from "drizzle-orm";
import type { PanelDb } from "@ventura/db";
import { settings } from "@ventura/db/schema/panel";

export interface CrmContacts {
  phonePrimary: string;
  phoneSecondary: string;
  telegramSupport: string;
  telegramChannel: string;
  email: string;
  address: string;
  workHours: string;
  mapUrl?: string;
}

export const DEFAULT_CRM_CONTACTS: CrmContacts = {
  phonePrimary: "+998 71 200 45 45",
  phoneSecondary: "+998 90 998 45 45",
  telegramSupport: "@ventura_support",
  telegramChannel: "@ventura_uz",
  email: "crm@ventura.uz",
  address: "Toshkent shahri, Yunusobod tumani, Amir Temur shoh ko'chasi, 107-B uy",
  workHours: "Dushanba — Shanba: 09:00 — 19:00",
  mapUrl: "https://yandex.uz/maps/-/CDuWv-~O",
};

export const CRM_CONTACTS_SETTING_KEY = "crm_contacts";

export async function getCrmContacts(db: PanelDb): Promise<CrmContacts> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, CRM_CONTACTS_SETTING_KEY))
    .limit(1);

  if (!row || typeof row.value !== "object" || row.value === null) {
    return DEFAULT_CRM_CONTACTS;
  }

  const v = row.value as Record<string, string>;
  return {
    phonePrimary: v.phonePrimary || DEFAULT_CRM_CONTACTS.phonePrimary,
    phoneSecondary: v.phoneSecondary || DEFAULT_CRM_CONTACTS.phoneSecondary,
    telegramSupport: v.telegramSupport || DEFAULT_CRM_CONTACTS.telegramSupport,
    telegramChannel: v.telegramChannel || DEFAULT_CRM_CONTACTS.telegramChannel,
    email: v.email || DEFAULT_CRM_CONTACTS.email,
    address: v.address || DEFAULT_CRM_CONTACTS.address,
    workHours: v.workHours || DEFAULT_CRM_CONTACTS.workHours,
    mapUrl: v.mapUrl || DEFAULT_CRM_CONTACTS.mapUrl,
  };
}

export async function setCrmContacts(db: PanelDb, data: CrmContacts, updatedByUserId?: string): Promise<void> {
  await db
    .insert(settings)
    .values({
      key: CRM_CONTACTS_SETTING_KEY,
      value: data,
      updatedBy: updatedByUserId ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        value: data,
        updatedBy: updatedByUserId ?? null,
        updatedAt: new Date(),
      },
    });
}
