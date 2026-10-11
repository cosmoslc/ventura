import { parseManifest } from "@ventura/tenants";
import { features as manifest, template } from "@/features";

/** Shablon manifesti tekshirilgan holda (standart qiymatlar bilan). Server, proxy va menyu shundan foydalanadi. */
export const { features } = parseManifest({ template, features: manifest });
