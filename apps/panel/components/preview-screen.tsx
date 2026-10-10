"use client";

import * as React from "react";
import {
  Bell,
  Download,
  ExternalLink,
  FolderKanban,
  Globe,
  LogOut,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Server,
  Shield,
  Trash2,
  TriangleAlert,
  User,
} from "lucide-react";
import { Avatar } from "@ventura/ui/avatar";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ventura/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ventura/ui/dropdown-menu";
import { Checkbox, ChoiceField, Radio, RadioCard, RadioGroup } from "@ventura/ui/checkbox";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { ConfirmModal, Modal } from "@ventura/ui/modal";
import { Pagination } from "@ventura/ui/pagination";
import { PhoneInput } from "@ventura/ui/phone-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { Sidebar } from "@ventura/ui/sidebar";
import { StatCard } from "@ventura/ui/stat-card";
import { Switch } from "@ventura/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { ThemeToggle } from "@ventura/ui/theme-toggle";
import { ProfileButton, Topbar } from "@ventura/ui/topbar";
import {
  navSections,
  projects as allProjects,
  stats,
  statusMeta,
  type ProjectRow,
  type ProjectStatus,
} from "@/lib/mock-data";

const STAT_ICONS = [FolderKanban, Rocket, TriangleAlert, Server];
const PAGE_SIZE = 10;

export function PreviewScreen() {
  const [active, setActive] = React.useState("projects-all");
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const [rows, setRows] = React.useState<ProjectRow[]>(allProjects);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<"all" | ProjectStatus>("all");
  const [page, setPage] = React.useState(1);

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [centerOpen, setCenterOpen] = React.useState(false);
  // Ma'lumot alohida saqlanadi: yopilish animatsiyasi paytida matn yo'qolib qolmasin
  const [confirm, setConfirmData] = React.useState<{
    title: string;
    message: React.ReactNode;
    onConfirm: () => void;
    requireText?: string;
  } | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const setConfirm = (c: NonNullable<typeof confirm>) => {
    setConfirmData(c);
    setConfirmOpen(true);
  };

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (status === "all" || r.status === status) &&
        (!q || r.name.toLowerCase().includes(q) || r.domain.includes(q) || r.client.toLowerCase().includes(q)),
    );
  }, [rows, query, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function toggleSidebar() {
    if (window.matchMedia("(max-width: 900px)").matches) setMobileOpen((v) => !v);
    else setCollapsed((v) => !v);
  }

  function askDelete(row: ProjectRow) {
    setConfirm({
      title: "Loyihani o'chirasizmi?",
      message: (
        <>
          <b className="font-semibold text-foreground">{row.name}</b> ({row.domain}) savatga o'tkaziladi. 30 kun ichida
          tiklash mumkin.
        </>
      ),
      onConfirm: () => setRows((rs) => rs.filter((r) => r.id !== row.id)),
    });
  }

  return (
    <div className="min-h-dvh">
      <Topbar
        collapsed={collapsed}
        onToggleSidebar={toggleSidebar}
        brandSubtitle="Boshqaruv paneli"
        searchPlaceholder="Loyiha, domen, server…"
      >
        <div className="relative">
          <Button variant="icon" size="icon" aria-label="Bildirishnomalar (3)">
            <Bell />
          </Button>
          <span className="pointer-events-none absolute -top-1 -right-1 grid h-[17px] min-w-[17px] place-items-center rounded-full border-2 border-(--topbar-bg) bg-destructive px-1 font-mono text-2xs font-bold text-destructive-foreground">
            3
          </span>
        </div>
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ProfileButton name="Saidakbar Saidov" role="Super admin" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>
              <div className="text-body font-bold text-foreground">Saidakbar Saidov</div>
              <div className="font-mono text-caption text-muted-foreground">admin@ventura.uz</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User /> Profil
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Shield /> Xavfsizlik va 2FA
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Bell /> Bildirishnomalar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem danger>
              <LogOut /> Chiqish
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Topbar>

      <div className="flex">
        <Sidebar
          sections={navSections}
          activeId={active}
          onSelect={(id) => {
            setActive(id);
            setMobileOpen(false);
          }}
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
          footer={
            <div className="rounded-card border border-border-soft bg-muted p-3">
              <div className="type-eyebrow text-muted-foreground">Uydagi server</div>
              <div className="mt-1.5 flex items-center gap-2 text-body font-semibold text-foreground">
                <span className="size-2 rounded-full bg-(--success-fg)" /> Onlayn · 99.98%
              </div>
            </div>
          }
        />

        <main className="min-w-0 flex-1 animate-[page-in_480ms_var(--ease-ios)] p-4 sm:p-6 lg:p-8">
          {/* Sahifa sarlavhasi */}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="type-heading text-(length:--page-title-size) leading-tight text-foreground">
                Barcha loyihalar
              </h1>
              <p className="mt-1 text-body text-muted-foreground">
                Mijoz tizimlari, ularning domeni, deploy manzili va holati.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost">
                <Download /> Eksport
              </Button>
              <Button onClick={() => setDrawerOpen(true)}>
                <Plus /> Yangi loyiha
              </Button>
            </div>
          </div>

          {/* 4 ta stat-card */}
          <div className="grid grid-cols-1 gap-3.5 min-[560px]:grid-cols-2 min-[1200px]:grid-cols-4">
            {stats.map((s, i) => {
              const Icon = STAT_ICONS[i]!;
              return (
                <StatCard
                  key={s.label}
                  icon={<Icon />}
                  label={s.label}
                  value={s.value}
                  tone={s.tone}
                  trend={"trend" in s ? s.trend : undefined}
                />
              );
            })}
          </div>

          {/* Jadval */}
          <Card className="mt-6 overflow-hidden">
            <CardHeader>
              <div>
                <CardTitle>Loyihalar ro'yxati</CardTitle>
                <CardDescription>{filtered.length} ta loyiha topildi</CardDescription>
              </div>
              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                <div className="min-w-0 flex-1 sm:w-60 sm:flex-none">
                  <Input
                    icon={<Search />}
                    placeholder="Nom yoki domen…"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                    aria-label="Loyihalarni qidirish"
                  />
                </div>
                <Select
                  value={status}
                  onValueChange={(v) => {
                    setStatus(v as typeof status);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-44" aria-label="Holat bo'yicha filtr">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Barcha holatlar</SelectItem>
                    {(Object.keys(statusMeta) as ProjectStatus[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {statusMeta[k].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <TableWrap>
              <Table className="min-w-[860px]">
                <THead>
                  <tr>
                    <Th>Loyiha</Th>
                    <Th>Domen</Th>
                    <Th>Shablon</Th>
                    <Th>Manzil</Th>
                    <Th>Holat</Th>
                    <Th>Oxirgi deploy</Th>
                    <Th className="text-right">Amallar</Th>
                  </tr>
                </THead>
                <TBody>
                  {visible.map((r) => (
                    <Tr key={r.id}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar name={r.name} size={32} />
                          <div className="min-w-0">
                            <div className="truncate text-body font-bold text-foreground">{r.name}</div>
                            <div className="truncate text-caption text-muted-foreground">{r.client}</div>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <a
                          href="#"
                          className="inline-flex items-center gap-1 font-mono text-xs text-primary-text hover:underline"
                        >
                          {r.domain}
                          <ExternalLink className="size-3 opacity-60" />
                        </a>
                      </Td>
                      <Td>
                        <span className="font-mono text-xs">{r.template}</span>
                      </Td>
                      <Td>
                        <div className="text-xs text-foreground">{r.target}</div>
                        <div className="font-mono text-caption text-muted-foreground">{r.mode}</div>
                      </Td>
                      <Td>
                        <Badge tone={statusMeta[r.status].tone} dot>
                          {statusMeta[r.status].label}
                        </Badge>
                      </Td>
                      <Td>
                        <span className="font-mono text-xs whitespace-nowrap">{r.lastDeploy}</span>
                      </Td>
                      <Td className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="subtle" size="icon-sm" aria-label={`${r.name} amallari`}>
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <ExternalLink /> Ochish
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <RefreshCw /> Qayta deploy
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setDrawerOpen(true)}>
                              <Pencil /> Tahrirlash
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem danger onSelect={() => askDelete(r)}>
                              <Trash2 /> O'chirish
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </Td>
                    </Tr>
                  ))}
                  {visible.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-14 text-center">
                        <div className="mx-auto mb-3 grid size-12 place-items-center rounded-card border border-border bg-muted text-muted-foreground">
                          <Search className="size-5" />
                        </div>
                        <div className="type-heading text-title text-foreground">Hech narsa topilmadi</div>
                        <div className="mt-1 text-body text-muted-foreground">
                          Qidiruv yoki filtrni o'zgartirib ko'ring.
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </TBody>
              </Table>
            </TableWrap>
            <Pagination
              page={current}
              pageCount={pageCount}
              total={filtered.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </Card>

          {/* Forma + komponentlar */}
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <ClientForm
              onDelete={() =>
                setConfirm({
                  title: "Mijozni o'chirasizmi?",
                  message:
                    "Mijoz va unga bog'langan 2 ta loyiha savatga o'tkaziladi. Bu amal audit jurnaliga yoziladi.",
                  onConfirm: () => {},
                })
              }
            />

            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Modal va holatlar</CardTitle>
                  <CardDescription>Modal turlari, tugmalar va badge'lar</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label>Modallar</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setDrawerOpen(true)}>O'ngdan panel</Button>
                    <Button variant="ghost" onClick={() => setCenterOpen(true)}>
                      Markaziy
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() =>
                        setConfirm({
                          title: "Serverni o'chirasizmi?",
                          message: "uy-server-01 paneldan uziladi. Undagi 4 ta loyiha ishlashda davom etadi.",
                          onConfirm: () => {},
                        })
                      }
                    >
                      Tasdiqlash
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Tugmalar</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button>Primary</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="danger">Danger</Button>
                    <Button variant="ghost" size="sm">
                      Kichik
                    </Button>
                    <Button disabled>O'chiq</Button>
                    <Button variant="icon" size="icon" aria-label="Yangilash">
                      <RefreshCw />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Badge'lar</Label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(statusMeta) as ProjectStatus[]).map((k) => (
                      <Badge key={k} tone={statusMeta[k].tone} dot>
                        {statusMeta[k].label}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Toast</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        toast({
                          tone: "success",
                          title: "Saqlandi",
                          description: "O'zgarishlar audit jurnaliga yozildi.",
                        })
                      }
                    >
                      Muvaffaqiyat
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        toast({
                          tone: "info",
                          title: "Deploy boshlandi",
                          description: "bilim.ventura.uz · navbatda 1-o'rinda",
                        })
                      }
                    >
                      Ma'lumot
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        toast({ tone: "warning", title: "SSL tugashiga 14 kun qoldi", description: "crm.bilim.uz" })
                      }
                    >
                      Ogohlantirish
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        toast({
                          tone: "danger",
                          title: "Build yiqildi",
                          description: "Oldingi versiya ishlashda davom etyapti.",
                        })
                      }
                    >
                      Xato
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <ProjectSettings
            onDelete={() =>
              setConfirm({
                title: "Loyihani butunlay o'chirasizmi?",
                message:
                  "Bilim akademiyasi savatga o'tkaziladi, 30 kundan keyin butunlay o'chadi. Bu amal audit jurnaliga yoziladi.",
                requireText: "bilim",
                onConfirm: () =>
                  toast({ tone: "danger", title: "Loyiha savatga o'tkazildi", description: "bilim.ventura.uz" }),
              })
            }
          />
        </main>
      </div>

      {/* O'ngdan chiqadigan modal */}
      <Modal
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Yangi loyiha"
        description="Shablondan mijoz tizimini yaratish (deploysiz)."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDrawerOpen(false)}>
              Bekor qilish
            </Button>
            <Button onClick={() => setDrawerOpen(false)}>
              <Rocket /> Yaratish
            </Button>
          </>
        }
      >
        <ProjectFields />
      </Modal>

      {/* Markaziy modal */}
      <Modal
        open={centerOpen}
        onOpenChange={setCenterOpen}
        position="center"
        title="Domen ulash"
        description="DNS provayderda quyidagi yozuvni qo'shing."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCenterOpen(false)}>
              Keyinroq
            </Button>
            <Button onClick={() => setCenterOpen(false)}>Tekshirish</Button>
          </>
        }
      >
        <div>
          <Label htmlFor="c-domain">Domen</Label>
          <Input id="c-domain" icon={<Globe />} defaultValue="crm.bilim.uz" />
        </div>
        <div className="rounded-card border border-border bg-muted p-4 font-mono text-xs leading-6 text-foreground">
          <div>
            <span className="text-muted-foreground">Turi:</span> A
          </div>
          <div>
            <span className="text-muted-foreground">Nom:</span> crm
          </div>
          <div>
            <span className="text-muted-foreground">Qiymat:</span> 185.74.6.21
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        onConfirm={() => confirm?.onConfirm()}
        requireText={confirm?.requireText}
      />
    </div>
  );
}

function ClientForm({ onDelete }: { onDelete: () => void }) {
  const [phone, setPhone] = React.useState("");
  const [tried, setTried] = React.useState(false);
  const phoneInvalid = tried && phone.length !== 9;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Mijoz ma'lumotlari</CardTitle>
          <CardDescription>Input, select, telefon va tugmalar</CardDescription>
        </div>
        <Badge tone="info">Qoralama</Badge>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            setTried(true);
          }}
          noValidate
        >
          <div>
            <Label htmlFor="f-name">Ism familiya</Label>
            <Input id="f-name" placeholder="Masalan: Aziza Karimova" defaultValue="Aziza Karimova" />
          </div>
          <div>
            <Label htmlFor="f-company">Kompaniya</Label>
            <Input id="f-company" placeholder="O'quv markaz nomi" />
          </div>
          <div>
            <Label htmlFor="f-email">Email</Label>
            <Input id="f-email" type="email" icon={<Mail />} placeholder="mijoz@example.uz" />
          </div>
          <div>
            <Label htmlFor="f-phone">Telefon</Label>
            <PhoneInput id="f-phone" value={phone} onValueChange={setPhone} invalid={phoneInvalid} />
            {phoneInvalid ? <FieldHint error>Telefon raqami 9 ta raqamdan iborat bo'lishi kerak</FieldHint> : null}
          </div>
          <div>
            <Label>Shablon</Label>
            <Select defaultValue="edu-crm">
              <SelectTrigger aria-label="Shablon">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="edu-crm">O'quv markaz CRM</SelectItem>
                <SelectItem value="sawmill">Pilorama tizimi</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Obuna holati</Label>
            <Select>
              <SelectTrigger aria-label="Obuna holati">
                <SelectValue placeholder="Tanlang…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trial">Sinov (14 kun)</SelectItem>
                <SelectItem value="active">Faol</SelectItem>
                <SelectItem value="suspended">To'xtatilgan</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="f-disabled">Mijoz ID (o'zgarmaydi)</Label>
            <Input id="f-disabled" disabled value="cl_8f2a91c4" className="font-mono" readOnly />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4 sm:col-span-2">
            <Button type="submit">Saqlash</Button>
            <Button
              variant="ghost"
              type="reset"
              onClick={() => {
                setPhone("");
                setTried(false);
              }}
            >
              Bekor qilish
            </Button>
            <Button variant="danger" className="ml-auto" onClick={onDelete}>
              <Trash2 /> O'chirish
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ProjectFields() {
  const [phone, setPhone] = React.useState("901234567");
  return (
    <>
      <div>
        <Label htmlFor="d-name">Loyiha nomi</Label>
        <Input id="d-name" placeholder="Bilim akademiyasi" />
      </div>
      <div>
        <Label htmlFor="d-slug">Subdomen</Label>
        <div className="flex items-center gap-2">
          <Input id="d-slug" placeholder="bilim" className="font-mono" />
          <span className="shrink-0 font-mono text-body text-muted-foreground">.ventura.uz</span>
        </div>
        <FieldHint>Kichik harflar, raqamlar va chiziqcha</FieldHint>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Shablon</Label>
          <Select defaultValue="edu-crm">
            <SelectTrigger aria-label="Shablon">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="edu-crm">O'quv markaz CRM</SelectItem>
              <SelectItem value="sawmill">Pilorama tizimi</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Deploy manzili</Label>
          <Select defaultValue="home">
            <SelectTrigger aria-label="Deploy manzili">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="home">Uydagi server</SelectItem>
              <SelectItem value="vps">Online VPS</SelectItem>
              <SelectItem value="vercel">Vercel</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="d-phone">Ega telefoni</Label>
        <PhoneInput id="d-phone" value={phone} onValueChange={setPhone} />
      </div>
      <div>
        <Label>Baza strategiyasi</Label>
        <RadioGroup defaultValue="db_per_tenant" aria-label="Baza strategiyasi">
          <RadioCard
            value="db_per_tenant"
            title="Alohida baza"
            description="Standart: to'liq ajratilgan, alohida zahira"
          />
          <RadioCard value="shared_db" title="Umumiy baza" description="Eng arzon, tenant_id + RLS" />
          <RadioCard
            value="dedicated_server"
            title="Alohida server"
            description="Katta mijoz yoki qonun talabi bo'lsa"
          />
        </RadioGroup>
      </div>
    </>
  );
}

const FEATURES = [
  { key: "attendance", name: "Davomat", desc: "Guruhlar bo'yicha kunlik davomat", on: true },
  { key: "finance", name: "Moliya", desc: "To'lovlar va qarzdorlik", on: true, kind: "O'zak" },
  { key: "coins", name: "Coinlar", desc: "O'quvchilarni rag'batlantirish tizimi", on: true },
  { key: "exams", name: "Imtihonlar", desc: "Oylik imtihon va natijalar", on: false },
  { key: "sms", name: "SMS xabarnomalar", desc: "Qarzdorlik va davomat haqida SMS", on: false },
  {
    key: "branches",
    name: "Ko'p filialli rejim",
    desc: "Loyiha sozlamasi boshqaradi",
    on: false,
    kind: "Rejim",
    locked: true,
  },
] as const;

function ProjectSettings({ onDelete }: { onDelete: () => void }) {
  const [enabled, setEnabled] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(FEATURES.map((f) => [f.key, f.on])),
  );
  const count = Object.values(enabled).filter(Boolean).length;

  return (
    <Card className="mt-6">
      <CardHeader>
        <div>
          <CardTitle>Loyiha sozlamalari</CardTitle>
          <CardDescription>Tablar, switch, checkbox, radio, textarea va xavfli amal tasdig'i</CardDescription>
        </div>
        <Badge tone="success" dot>
          Ishlayapti
        </Badge>
      </CardHeader>
      <CardContent className="pt-2">
        <Tabs defaultValue="features">
          <TabsList aria-label="Loyiha bo'limlari">
            <TabsTrigger value="overview">Umumiy</TabsTrigger>
            <TabsTrigger value="features">
              Bo'limlar
              <span className="rounded-full bg-primary-soft px-2 py-0.5 font-mono text-caption font-semibold text-primary-text">
                {count}
              </span>
            </TabsTrigger>
            <TabsTrigger value="settings">Sozlamalar</TabsTrigger>
            <TabsTrigger value="domains">Domenlar</TabsTrigger>
            <TabsTrigger value="danger">Xavfli hudud</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <dl className="grid gap-x-6 gap-y-4 text-body sm:grid-cols-3">
              {[
                ["Shablon", "edu-crm · v1.4.0"],
                ["Deploy manzili", "Uydagi server · shared"],
                ["Baza", "db_per_tenant · db_bilim"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="mt-0.5 font-mono text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </TabsContent>

          <TabsContent value="features">
            <ul className="divide-y divide-border-soft">
              {FEATURES.map((f) => (
                <li key={f.key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-body font-semibold text-foreground">
                      {f.name}
                      {"kind" in f ? <Badge tone={f.kind === "O'zak" ? "warning" : "neutral"}>{f.kind}</Badge> : null}
                    </div>
                    <div className="text-xs text-muted-foreground">{f.desc}</div>
                  </div>
                  <Switch
                    aria-label={f.name}
                    checked={enabled[f.key]}
                    disabled={"locked" in f}
                    onCheckedChange={(on) => {
                      setEnabled((e) => ({ ...e, [f.key]: on }));
                      toast({
                        tone: on ? "success" : "info",
                        title: `${f.name} ${on ? "yoqildi" : "o'chirildi"}`,
                        description: "Deploysiz qo'llanadi, ma'lumotlar o'chirilmaydi.",
                      });
                    }}
                  />
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="settings">
            <form
              className="grid gap-5 lg:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                toast({ tone: "success", title: "Sozlamalar saqlandi" });
              }}
            >
              <div className="lg:col-span-2">
                <Label htmlFor="s-note">Ichki izoh</Label>
                <Textarea
                  id="s-note"
                  placeholder="Mijoz bilan kelishuvlar, eslatmalar…"
                  defaultValue="To'lov har oyning 5-sanasigacha."
                />
              </div>
              <fieldset className="space-y-3">
                <legend className="type-label mb-2 text-(--label-fg)">Telegram ogohlantirishlari</legend>
                <ChoiceField
                  control={<Checkbox defaultChecked />}
                  label="Build yiqilsa"
                  description="Oxirgi ishlagan versiya joyida qoladi"
                />
                <ChoiceField control={<Checkbox defaultChecked />} label="SSL tugashiga 14 kun qolsa" />
                <ChoiceField control={<Checkbox />} label="Yangi qurilmadan kirilsa" />
              </fieldset>
              <fieldset>
                <legend className="type-label mb-2 text-(--label-fg)">Deploy rejimi</legend>
                <RadioGroup defaultValue="shared" aria-label="Deploy rejimi" className="gap-3">
                  {[
                    ["shared", "Bitta ilova, ko'p mijoz (standart)"],
                    ["dedicated", "Mijozga alohida deploy"],
                    ["fork", "Alohida GitHub repo"],
                  ].map(([v, d]) => (
                    <ChoiceField
                      key={v}
                      control={<Radio value={v!} />}
                      label={<span className="font-mono">{v}</span>}
                      description={d}
                    />
                  ))}
                </RadioGroup>
              </fieldset>
              <div className="flex gap-2 border-t border-border pt-4 lg:col-span-2">
                <Button type="submit">Saqlash</Button>
                <Button variant="ghost" type="reset">
                  Bekor qilish
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="domains">
            <ul className="divide-y divide-border-soft">
              {(
                [
                  ["bilim.ventura.uz", "active", "Asosiy"],
                  ["crm.bilim.uz", "ssl_issuing", null],
                  ["www.bilim.uz", "pending_dns", null],
                ] as const
              ).map(([d, st, primary]) => (
                <li key={d} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <span className="flex items-center gap-2 font-mono text-body text-foreground">
                    {d}
                    {primary ? <Badge tone="info">{primary}</Badge> : null}
                  </span>
                  <Badge tone={st === "active" ? "success" : st === "ssl_issuing" ? "info" : "warning"} dot>
                    {st === "active" ? "Ishlayapti" : st === "ssl_issuing" ? "SSL chiqarilmoqda" : "DNS kutilmoqda"}
                  </Badge>
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="danger">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-(--danger-border) bg-(--danger-bg) p-4">
              <div>
                <div className="text-body font-semibold text-foreground">Loyihani o'chirish</div>
                <div className="text-xs text-muted-foreground">
                  Savatga o'tadi, 30 kundan keyin butunlay o'chadi. Nomini yozib tasdiqlash kerak.
                </div>
              </div>
              <Button variant="danger" onClick={onDelete}>
                <Trash2 /> Loyihani o'chirish
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
