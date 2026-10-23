// Muallif / Agent: Google Gemini
import { can } from "@ventura/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ventura/ui/card";
import { PageHeader } from "@ventura/ui/page-header";
import { getCrmContacts } from "@/lib/server/crm-contacts";
import { deps } from "@/lib/server/deps";
import { requireViewer } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { ContactsForm } from "./contacts-form";

export const metadata = { title: `CRM Aloqa & Manzil sozlamalari · ${uz.app.name}` };

export default async function ContactsSettingsPage() {
  const viewer = await requireViewer();
  const { db } = deps();
  const contacts = await getCrmContacts(db);

  return (
    <>
      <PageHeader
        title="CRM Aloqa & Manzil sozlamalari"
        description="crm.ventura.uz landing sahifasining pastki qismida ko'rsatiladigan telefon raqamlar, ofis manzili, Telegram va ish vaqti"
      />
      <div className="max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Aloqa ma'lumotlari</CardTitle>
            <CardDescription>
              Bu yerdagi o'zgarishlar darhol crm.ventura.uz saytining aloqa bo'limi va footerida yangilanadi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ContactsForm contacts={contacts} canEdit={can(viewer.role, "settings.manage")} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
