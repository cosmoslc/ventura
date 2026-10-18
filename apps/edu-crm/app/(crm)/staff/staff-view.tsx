"use client";

import {
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Users,
  Wallet,
  Award,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Avatar } from "@ventura/ui/avatar";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { FilterBar } from "@ventura/ui/filter-bar";
import { Input } from "@ventura/ui/input";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { StatCard } from "@ventura/ui/stat-card";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { displayPhone, formatDate, money } from "@/lib/format";
import { DEFAULT_STAFF_FIELDS, type FormField, STAFF_FIELD_TYPES, formCompletion } from "@/lib/form-fields";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
import { FieldsModal } from "../fields-modal";
import { saveStaffFieldsAction } from "./actions";
import type { PositionOption, StaffRow } from "./data";
import { StaffForm } from "./staff-form";
import { StaffLink, StaffMenu, type StaffPerms, TempPasswordModal } from "./staff-menu";

type FormFilter = "all" | "completed" | "incomplete";

export function StaffView({
  rows,
  positions,
  branches,
  fields,
  perms,
}: {
  rows: StaffRow[];
  positions: PositionOption[];
  branches: PickerBranch[];
  fields: FormField[];
  perms: StaffPerms;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [positionFilter, setPositionFilter] = React.useState("all");
  const [formFilter, setFormFilter] = React.useState<FormFilter>("all");
  const [editing, setEditing] = React.useState<StaffRow | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [fieldsOpen, setFieldsOpen] = React.useState(false);
  const [password, setPassword] = React.useState<string | null>(null);

  const completion = (r: StaffRow) => formCompletion(r.customData, fields);
  const branchNames = (ids: string[]) =>
    branches
      .filter((b) => ids.includes(b.id))
      .map((b) => b.name)
      .join(", ");

  // Kartalar — faqat bazadagi qiymatlardan (KPI hisob-kitobi E3 da, bu yerda faqat asosiy oklad)
  const stats = React.useMemo(() => {
    const fund = (type: StaffRow["salaryType"]) =>
      rows.filter((r) => r.salaryType === type).reduce((s, r) => s + r.monthlySalary, 0);
    const fixedFund = fund("fixed");
    const kpiFund = fund("kpi");
    return {
      kpiFund,
      total: fixedFund + kpiFund,
      done: rows.filter((r) => formCompletion(r.customData, fields).complete).length,
    };
  }, [rows, fields]);

  const q = query.trim().toLowerCase();
  const visible = rows.filter((r) => {
    if (q) {
      const hit =
        r.name.toLowerCase().includes(q) ||
        r.phone.includes(q.replace(/\D/g, "") || "\u0000") ||
        r.positions.some((p) => p.name.toLowerCase().includes(q));
      if (!hit) return false;
    }
    if (positionFilter !== "all" && !r.positions.some((p) => p.id === positionFilter)) return false;
    if (formFilter !== "all" && completion(r).complete !== (formFilter === "completed")) return false;
    return true;
  });
  const filtered = !!q || positionFilter !== "all" || formFilter !== "all";

  function openForm(row: StaffRow | null) {
    setEditing(row);
    setFormOpen(true);
  }

  // Yangi xodim — yaratish va biriktirish ruxsati birga kerak (lavozimsiz xodim bo'lmaydi)
  const canAdd = perms.create && perms.assign;

  return (
    <div className="space-y-4">
      <PageHeader
        title={uz.staff.title}
        description={uz.staff.subtitle}
        actions={
          <>
            <Button variant="ghost" onClick={() => setFieldsOpen(true)}>
              <ClipboardList /> {uz.staff.formSettings}
            </Button>
            {canAdd ? (
              <Button onClick={() => openForm(null)}>
                <Plus /> {uz.staff.add}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard tone={1} icon={<Users />} label={uz.staff.total} value={uz.staff.totalUnit(rows.length)} />
        <StatCard tone={2} icon={<Wallet />} label={uz.staff.fund} value={`${money(stats.total)} ${uz.common.som}`} />
        <StatCard
          tone={3}
          icon={<Award />}
          label={uz.staff.kpiFund}
          value={`${money(stats.kpiFund)} ${uz.common.som}`}
        />
        <StatCard
          tone={4}
          icon={<ClipboardList />}
          label={uz.staff.formDone}
          value={uz.staff.totalUnit(stats.done)}
          role="button"
          tabIndex={0}
          aria-pressed={formFilter === "completed"}
          className="cursor-pointer aria-pressed:border-(--ring-border)"
          onClick={() => setFormFilter((f) => (f === "completed" ? "all" : "completed"))}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setFormFilter((f) => (f === "completed" ? "all" : "completed"));
            }
          }}
        />
      </div>

      <FilterBar standalone>
        <div className="min-w-0 flex-1 sm:max-w-sm sm:min-w-64">
          <Input
            icon={<Search />}
            placeholder={uz.staff.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={positionFilter} onValueChange={setPositionFilter}>
          <SelectTrigger className="w-full sm:w-52" aria-label={uz.staff.colPosition}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{uz.staff.allPositions}</SelectItem>
            {positions.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={formFilter} onValueChange={(v) => setFormFilter(v as FormFilter)}>
          <SelectTrigger className="w-full sm:w-52" aria-label={uz.staff.colForm}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{uz.staff.allForms}</SelectItem>
            <SelectItem value="completed">{uz.staff.formsCompleted}</SelectItem>
            <SelectItem value="incomplete">{uz.staff.formsIncomplete}</SelectItem>
          </SelectContent>
        </Select>
        {filtered ? (
          <Button
            variant="ghost"
            size="sm"
            title={uz.staff.clearHint}
            onClick={() => {
              setQuery("");
              setPositionFilter("all");
              setFormFilter("all");
            }}
          >
            <RotateCcw /> {uz.staff.clear}
          </Button>
        ) : null}
        <span className="ml-auto text-caption text-muted-foreground">{uz.staff.shown(visible.length)}</span>
      </FilterBar>

      <Card className="overflow-hidden">
        {visible.length ? (
          <TableWrap>
            <Table className="min-w-[960px]">
              <THead>
                <tr>
                  <Th className="w-12 text-center">{uz.staff.colNo}</Th>
                  <Th>{uz.staff.colStaff}</Th>
                  <Th>{uz.staff.colPosition}</Th>
                  <Th>{uz.staff.colSalary}</Th>
                  <Th>{uz.staff.colForm}</Th>
                  <Th>{uz.staff.colExtra}</Th>
                  <Th className="text-right">{uz.common.actions}</Th>
                </tr>
              </THead>
              <TBody>
                {visible.map((r, i) => {
                  const c = completion(r);
                  return (
                    <Tr key={r.id}>
                      <Td className="text-center font-mono text-caption text-muted-foreground">{i + 1}</Td>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={r.name} size={34} />
                          <div className="min-w-0">
                            <StaffLink row={r} />
                            <div className="flex items-center gap-1 font-mono text-caption text-muted-foreground">
                              <Phone className="size-3" /> {displayPhone(r.phone) ?? uz.staff.phoneMissing}
                            </div>
                            <StateBadges row={r} />
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <PositionChips positions={r.positions} />
                      </Td>
                      <Td>
                        <div className="font-mono font-bold text-foreground">
                          {money(r.monthlySalary)} {uz.common.som}
                        </div>
                        <Badge tone={r.salaryType === "kpi" ? "info" : "success"} className="mt-1">
                          {uz.staff.salaryType[r.salaryType]}
                        </Badge>
                        {r.salaryType === "kpi" ? (
                          <div className="mt-1 text-caption text-muted-foreground">
                            {uz.staff.kpiDetail(money(r.kpiStudentAmount), money(r.kpiContractBonus))}
                          </div>
                        ) : null}
                      </Td>
                      <Td>
                        <FormBadge filled={c.filled} total={c.total} />
                      </Td>
                      <Td className="max-w-xs">
                        <div className="space-y-0.5 text-caption">
                          <div className="flex items-center gap-1 text-foreground">
                            <Building2 className="size-3 shrink-0 text-muted-foreground" />
                            <span className="truncate">{branchNames(r.branchIds) || uz.staff.noBranch}</span>
                          </div>
                          {r.birthDate ? (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="size-3" /> {formatDate(r.birthDate)}
                            </div>
                          ) : null}
                          {r.note ? (
                            <div className="truncate text-muted-foreground" title={r.note}>
                              {uz.staff.notePrefix} {r.note}
                            </div>
                          ) : null}
                        </div>
                      </Td>
                      <Td className="text-right">
                        <StaffMenu row={r} perms={perms} onEdit={() => openForm(r)} />
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState
            icon={<Users />}
            title={rows.length ? uz.staff.empty : uz.staff.emptyFirst}
            description={rows.length ? uz.staff.emptyHint : uz.staff.emptyFirstHint}
          />
        )}
      </Card>

      {perms.create || perms.edit ? (
        <StaffForm
          open={formOpen}
          onOpenChange={setFormOpen}
          editing={editing}
          positions={positions}
          branches={branches}
          fields={fields}
          perms={perms}
          onSaved={(pw) => {
            if (pw) setPassword(pw);
            router.refresh();
          }}
        />
      ) : null}
      <FieldsModal
        open={fieldsOpen}
        onOpenChange={setFieldsOpen}
        fields={fields}
        canWrite={perms.edit}
        defaults={DEFAULT_STAFF_FIELDS}
        types={STAFF_FIELD_TYPES}
        save={saveStaffFieldsAction}
        title={uz.staff.fieldsTitle}
        description={uz.staff.fieldsIntro}
      />
      <TempPasswordModal password={password} onClose={() => setPassword(null)} />
    </div>
  );
}

export function PositionChips({ positions }: { positions: StaffRow["positions"] }) {
  if (!positions.length) return <span className="text-caption text-muted-foreground">{uz.staff.noPosition}</span>;
  return (
    <div className="flex max-w-56 flex-wrap gap-1">
      {positions.map((p) => (
        <span
          key={p.id}
          className="type-badge inline-flex items-center gap-1.5 rounded-badge border px-2 py-0.5 whitespace-nowrap"
          style={{
            color: p.color,
            borderColor: `color-mix(in oklab, ${p.color} 35%, transparent)`,
            background: `color-mix(in oklab, ${p.color} 12%, transparent)`,
          }}
        >
          <span className="size-1.5 rounded-full bg-current" aria-hidden />
          {p.name}
        </span>
      ))}
    </div>
  );
}

export function FormBadge({ filled, total }: { filled: number; total: number }) {
  if (filled === total)
    return (
      <Badge tone="success">
        <CheckCircle2 className="size-3" /> {uz.staff.formFull}
      </Badge>
    );
  if (filled > 0)
    return (
      <Badge tone="warning">
        <Clock className="size-3" /> {uz.staff.formPartial(filled, total)}
      </Badge>
    );
  return <Badge tone="neutral">{uz.staff.formNone}</Badge>;
}

export function StateBadges({ row }: { row: StaffRow }) {
  if (!row.locked && !row.mustChangePassword && row.telegramLinked) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {row.locked ? (
        <Badge tone="danger" dot>
          {uz.staff.locked}
        </Badge>
      ) : null}
      {!row.locked && row.mustChangePassword ? (
        <Badge tone="warning" dot>
          {uz.staff.mustChange}
        </Badge>
      ) : null}
      {!row.locked && !row.mustChangePassword && !row.telegramLinked ? (
        <Badge tone="warning" dot>
          {uz.staff.telegramMissing}
        </Badge>
      ) : null}
    </div>
  );
}
