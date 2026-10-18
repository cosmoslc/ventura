import { ESKIZ_DEFAULT_SENDER, ESKIZ_TEST_MESSAGE } from "@ventura/integrations/eskiz";
import { smsContext } from "@/lib/server/sms/context";
import { smsOverview } from "@/lib/server/sms/provider";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { SmsSettingsView } from "./sms-settings-view";

export const metadata = { title: uz.sms.settingsTitle };

/** SMS sozlamalari: rejim (Ventura paketi / o'z Eskiz), Eskiz ulash, yuboruvchi nomi, tinch soatlar, test SMS. */
export default async function SmsSettingsPage() {
  const { tenant } = await requirePage("sms", "/sms/settings");
  const ctx = await smsContext(tenant);
  const overview = ctx.view.mode === "own" ? await smsOverview(ctx.db, ctx.row, ctx.secret) : null;
  return (
    <SmsSettingsView
      provider={ctx.view}
      nicks={overview?.nicks ?? []}
      eskizError={overview?.error ?? null}
      defaultSender={ESKIZ_DEFAULT_SENDER}
      testMessage={ESKIZ_TEST_MESSAGE}
    />
  );
}
