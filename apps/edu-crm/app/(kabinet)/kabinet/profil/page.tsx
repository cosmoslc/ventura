import { notFound } from "next/navigation";
import { getTenantDb } from "@/lib/server/deps";
import { ownDevices } from "@/lib/server/devices";
import { kabinetTeacher } from "@/lib/server/kabinet";
import { currentDeviceId } from "@/lib/server/request";
import { requireTeacher, requireTenant } from "@/lib/server/session";
import { displayPhone } from "@/lib/format";
import { uz } from "@/lib/uz";
import { AccountView } from "../../../(crm)/(settings)/account/account-view";
import { ProfileForm } from "./profile-form";

export const metadata = { title: uz.kabinet.profileTitle };

/** Kabinet profili (ADR 0062): o'z ma'lumotlarini tahrirlash va xavfsizlik (parol, Telegram, qurilmalar) */
export default async function KabinetProfilePage() {
  const tenant = await requireTenant();
  const staff = await requireTeacher();
  const db = getTenantDb(tenant);
  const [teacher, own] = await Promise.all([
    kabinetTeacher(db, staff.teacherId),
    ownDevices(db, staff.id, await currentDeviceId()),
  ]);
  if (!teacher) notFound();
  return (
    <div className="space-y-section">
      <ProfileForm
        teacher={{
          name: teacher.name,
          phone: displayPhone(teacher.phone) ?? teacher.phone,
          gender: teacher.gender,
          birthDate: teacher.birthDate ?? "",
        }}
      />
      <AccountView
        name={staff.name}
        phone={displayPhone(staff.phone) ?? staff.phone}
        director={false}
        positions={staff.positions}
        telegramLinked={staff.telegramLinked}
        groups={[]}
        devices={own.devices}
        sessionCount={own.sessionCount}
        header={false}
      />
    </div>
  );
}
