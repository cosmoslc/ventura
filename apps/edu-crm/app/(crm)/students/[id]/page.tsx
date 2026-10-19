import { notFound } from "next/navigation";
import { z } from "zod";
import { hasFeature } from "@ventura/tenants";
import { getBranchContext } from "@/lib/server/branch";
import { coinBalance } from "@/lib/server/coins";
import { ensurePaymentMethods, getFinanceSettings } from "@/lib/server/finance";
import { todayTashkent } from "@/lib/server/memberships";
import { getTenantDb } from "@/lib/server/deps";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { courseOptions, getStudentFields, groupChoices, listStudents, studentHistory, studentNotesOf } from "../data";
import { listGroups, studentMemberships } from "../../groups/data";
import { groupPerms } from "../../groups/perms";
import { studentFinance } from "../../payments/data";
import { financePerms } from "../../payments/perms";
import { studentPerms } from "../perms";
import { StudentProfile } from "../student-profile";

export const metadata = { title: uz.students.title };

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenant, staff } = await requirePage("students", "/students");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const db = getTenantDb(tenant);
  const branch = await getBranchContext();
  // Ko'rinish xodimning filial cheklovi bo'yicha (tepadagi tanlovdan qat'i nazar)
  const scope = staff.scope === "all" ? null : branch.options.map((b) => b.id);
  const [student] = await listStudents(db, scope, id.data);
  if (!student) notFound();
  const fperms = financePerms(staff.access);
  const withFinance = fperms.view && (await hasFeature(tenant, "payments"));
  const today = todayTashkent();
  const fields = await getStudentFields(db);
  const withCoins = await hasFeature(tenant, "coins");
  const [notes, history, courses, choices, memberships, groups, finance, methods, fsettings, coins] = await Promise.all(
    [
      studentNotesOf(db, student.id),
      studentHistory(db, student.id),
      courseOptions(db),
      groupChoices(db, scope, fields),
      studentMemberships(db, student.id),
      listGroups(db, [student.branchId]),
      withFinance ? studentFinance(db, student.id, today) : Promise.resolve(null),
      withFinance ? ensurePaymentMethods(db) : Promise.resolve([]),
      withFinance ? getFinanceSettings(db) : Promise.resolve(null),
      withCoins ? coinBalance(db, student.id) : Promise.resolve(null),
    ],
  );
  return (
    <StudentProfile
      student={student}
      notes={notes}
      history={history}
      branches={branch.options}
      selectedBranch={branch.selected}
      courses={courses}
      fields={fields}
      groupChoices={choices}
      perms={studentPerms(staff.access)}
      memberships={memberships}
      groupOptions={groups.map((g) => ({
        id: g.id,
        title: g.name,
        subtitle: `${g.courseName} · ${g.teacherName} · ${g.startTime}`,
      }))}
      groupPerms={groupPerms(staff.access)}
      coins={coins}
      finance={
        finance && fsettings
          ? {
              summary: finance.account.summary,
              groups: finance.groups,
              entries: finance.entries,
              discounts: finance.discounts,
              methods,
              perms: fperms,
              maxDiscountPercent: fsettings.maxDiscountPercent,
              currentMonth: today.slice(0, 7),
            }
          : null
      }
    />
  );
}
