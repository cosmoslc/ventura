"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  FolderKanban,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Rocket,
  Server,
  Trash2,
  TriangleAlert,
  User,
} from "lucide-react";
import { Avatar } from "@ventura/ui/avatar";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ventura/ui/card";
import { ColorSwatches } from "@ventura/ui/color-swatches";
import { Checkbox, ChoiceField, Radio, RadioCard, RadioGroup } from "@ventura/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ventura/ui/dropdown-menu";
import { FilterBar, FilterDates, FilterEnd, FilterSearch, FilterSelect } from "@ventura/ui/filter-bar";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { LogView } from "@ventura/ui/log-view";
import { LineChart } from "@ventura/ui/line-chart";
import { Logo } from "@ventura/ui/logo";
import { DonutChart } from "@ventura/ui/donut-chart";
import { Gauge } from "@ventura/ui/gauge";
import { Meter } from "@ventura/ui/meter";
import { Sparkline } from "@ventura/ui/sparkline";
import { TrendChart } from "@ventura/ui/trend-chart";
import { MoneyInput } from "@ventura/ui/money-input";
import { demoColors, demoMetrics } from "@/lib/mock-data";
import { ConfirmModal, Modal } from "@ventura/ui/modal";
import { Notice } from "@ventura/ui/notice";
import { Pagination } from "@ventura/ui/pagination";
import { PhoneInput } from "@ventura/ui/phone-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { StatCard } from "@ventura/ui/stat-card";
import { StepList } from "@ventura/ui/step-list";
import { Stepper } from "@ventura/ui/stepper";
import { Switch } from "@ventura/ui/switch";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { Textarea } from "@ventura/ui/textarea";
import { ThemeToggle } from "@ventura/ui/theme-toggle";
import { toast } from "@ventura/ui/toast";
import { ProfileButton, Topbar } from "@ventura/ui/topbar";

const SECTIONS = [
  ["ranglar", "Ranglar"],
  ["tipografiya", "Tipografiya"],
  ["tugmalar", "Tugmalar"],
  ["inputlar", "Inputlar"],
  ["tanlov", "Tanlov"],
  ["badge", "Badge"],
  ["kartochkalar", "Kartochkalar"],
  ["grafiklar", "Grafiklar"],
  ["jadval", "Jadval"],
  ["tablar", "Tablar"],
  ["qadamlar", "Qadamlar"],
  ["menyu", "Menyu"],
  ["topbar", "Topbar"],
  ["modal", "Modal va toast"],
  ["jarayon", "Jarayon va log"],
  ["avatar", "Avatar va logo"],
] as const;

/** Bir xil kontent light va dark rejimda yonma-yon (tokenlar ustun ichida qayta aniqlanadi). */
function Both({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {(["light", "dark"] as const).map((mode) => (
        <div
          key={mode}
          data-brand="ventura"
          className={mode === "dark" ? "dark" : undefined}
          style={{ colorScheme: mode }}
        >
          <div className="h-full rounded-card border border-border bg-background p-5 text-foreground">
            <div className="type-eyebrow mb-4 text-muted-foreground">{mode === "light" ? "Light" : "Dark"}</div>
            <div className={className}>{children}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <h2 className="type-heading text-lg text-foreground">{title}</h2>
      {description ? (
        <p className="mt-1 mb-4 text-body text-muted-foreground">{description}</p>
      ) : (
        <div className="mb-4" />
      )}
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

const SWATCHES: [string, string][] = [
  ["--primary", "primary"],
  ["--primary-hover", "primary-hover"],
  ["--primary-soft", "primary-soft"],
  ["--background", "background"],
  ["--card", "card"],
  ["--secondary", "secondary"],
  ["--muted", "muted"],
  ["--border", "border"],
  ["--input", "input"],
  ["--foreground", "foreground"],
  ["--muted-foreground", "muted-foreground"],
  ["--destructive", "destructive"],
];

const TONES = ["success", "warning", "danger", "info", "neutral"] as const;

function Colors() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {SWATCHES.map(([v, name]) => (
          <div key={v}>
            <div className="h-12 rounded-btn border border-border" style={{ background: `var(${v})` }} />
            <div className="mt-1.5 truncate font-mono text-caption text-muted-foreground">{name}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-3">
        {TONES.map((t) => (
          <div key={t}>
            <div
              className="grid h-12 place-items-center rounded-btn border font-mono text-caption font-semibold"
              style={{ background: `var(--${t}-bg)`, color: `var(--${t}-fg)`, borderColor: `var(--${t}-border)` }}
            >
              Aa
            </div>
            <div className="mt-1.5 truncate font-mono text-caption text-muted-foreground">{t}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          ["--btn-primary-bg", "btn-primary"],
          ["--nav-active-bg", "nav-active"],
          ["--btn-danger-bg", "btn-danger"],
        ].map(([v, name]) => (
          <div key={v}>
            <div className="h-12 rounded-btn" style={{ background: `var(${v})` }} />
            <div className="mt-1.5 truncate font-mono text-caption text-muted-foreground">{name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Typography() {
  return (
    <div className="space-y-3">
      <div className="type-heading text-(length:--page-title-size) leading-tight">Sahifa sarlavhasi · 24px</div>
      <div className="type-heading text-lg">Modal sarlavhasi · 18px</div>
      <div className="type-heading text-title">Kartochka sarlavhasi · text-title 15px</div>
      <div className="text-sm">Tugma, input · text-sm 14px</div>
      <div className="text-body">Izoh, menyu bandi · text-body 13px</div>
      <div className="text-xs text-muted-foreground">Jadval, yorliq · text-xs 12px</div>
      <div className="text-caption text-muted-foreground">Ikkinchi qator · text-caption 11px</div>
      <div className="text-2xs text-muted-foreground">Sanoq · text-2xs 10px</div>
      <div className="type-eyebrow text-muted-foreground">Bo&apos;lim sarlavhasi · eyebrow</div>
      <div className="type-label text-(--label-fg)">Forma yorlig&apos;i · type-label</div>
      <div className="font-mono text-body">bilim.ventura.uz · 10.10.2026 14:32 · +998 90 123 45 67</div>
    </div>
  );
}

function Buttons() {
  return (
    <div className="space-y-5">
      <Row label="Variantlar">
        <Button>Primary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
      </Row>
      <Row label="Ikonka bilan">
        <Button>
          <Plus /> Yangi loyiha
        </Button>
        <Button variant="ghost">
          <Download /> Eksport
        </Button>
        <Button variant="danger">
          <Trash2 /> O&apos;chirish
        </Button>
      </Row>
      <Row label="Kichik (32px) va o'chiq">
        <Button size="sm">Kichik</Button>
        <Button variant="ghost" size="sm">
          Kichik ghost
        </Button>
        <Button disabled>O&apos;chiq</Button>
        <Button variant="ghost" disabled>
          O&apos;chiq
        </Button>
      </Row>
      <Row label="Ikonka tugmalari">
        <Button variant="icon" size="icon" aria-label="Yangilash">
          <RefreshCw />
        </Button>
        <Button variant="subtle" size="icon-sm" aria-label="Amallar">
          <MoreHorizontal />
        </Button>
      </Row>
    </div>
  );
}

function Inputs() {
  const [phone, setPhone] = React.useState("90123");
  const [price, setPrice] = React.useState<number | null>(1500000);
  const [color, setColor] = React.useState(demoColors[0]!.value);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label>Oddiy</Label>
        <Input placeholder="Loyiha nomi" />
      </div>
      <div>
        <Label>Ikonkali</Label>
        <Input icon={<Mail />} placeholder="mijoz@example.uz" />
      </div>
      <div>
        <Label>Xato holati</Label>
        <Input aria-invalid defaultValue="bilim akademiyasi" />
        <FieldHint error>Faqat kichik harf va chiziqcha</FieldHint>
      </div>
      <div>
        <Label>O&apos;chiq</Label>
        <Input disabled value="cl_8f2a91c4" readOnly className="font-mono" />
      </div>
      <div>
        <Label>Select</Label>
        <Select defaultValue="edu-crm">
          <SelectTrigger aria-label="Shablon">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="edu-crm">O&apos;quv markaz CRM</SelectItem>
            <SelectItem value="sawmill">Pilorama tizimi</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Telefon (noto&apos;liq)</Label>
        <PhoneInput value={phone} onValueChange={setPhone} invalid={phone.length !== 9} />
      </div>
      <div>
        <Label>Pul (MoneyInput)</Label>
        <MoneyInput value={price} onValueChange={setPrice} suffix="so'm" placeholder="1 500 000" />
      </div>
      <div>
        <Label>Rang tanlash (ColorSwatches)</Label>
        <ColorSwatches value={color} onChange={setColor} options={demoColors} custom={{ label: "Boshqa rang" }} />
      </div>
      <div className="sm:col-span-2">
        <Label>Textarea</Label>
        <Textarea placeholder="Ichki izoh…" />
        <FieldHint>Faqat adminlarga ko&apos;rinadi</FieldHint>
      </div>
    </div>
  );
}

function Choices() {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="space-y-3">
        <ChoiceField control={<Checkbox defaultChecked />} label="Belgilangan" description="Izoh matni" />
        <ChoiceField control={<Checkbox />} label="Belgilanmagan" />
        <ChoiceField control={<Checkbox disabled />} label="O'chiq" />
      </div>
      <RadioGroup defaultValue="shared" className="gap-3" aria-label="Rejim">
        <ChoiceField control={<Radio value="shared" />} label="shared" description="Standart" />
        <ChoiceField control={<Radio value="dedicated" />} label="dedicated" />
      </RadioGroup>
      <div className="space-y-3">
        <ChoiceField control={<Switch defaultChecked aria-label="Yoqilgan" />} label="Yoqilgan" />
        <ChoiceField control={<Switch aria-label="O'chiq" />} label="O'chirilgan" />
        <ChoiceField control={<Switch disabled aria-label="Bloklangan" />} label="Bloklangan (rejim)" />
      </div>
      <RadioGroup defaultValue="db_per_tenant" aria-label="Baza">
        <RadioCard value="db_per_tenant" title="Alohida baza" description="Standart" />
        <RadioCard value="shared_db" title="Umumiy baza" description="tenant_id + RLS" />
      </RadioGroup>
    </div>
  );
}

function Badges() {
  return (
    <div className="space-y-3">
      <Row label="Nuqta bilan">
        <Badge tone="success" dot>
          Ishlayapti
        </Badge>
        <Badge tone="info" dot>
          Build
        </Badge>
        <Badge tone="danger" dot>
          Yiqildi
        </Badge>
        <Badge tone="warning" dot>
          To&apos;xtatilgan
        </Badge>
        <Badge tone="neutral" dot>
          Sinov
        </Badge>
      </Row>
      <Row label="Nuqtasiz">
        <Badge tone="info">Asosiy</Badge>
        <Badge tone="warning">O&apos;zak</Badge>
        <Badge>Rejim</Badge>
      </Row>
    </div>
  );
}

const TREND = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn"].map((m, i) => ({
  label: m,
  tip: `${m} 2026`,
  values: [18 + ((i * 7) % 9), 8 + ((i * 5) % 6)].map((v) => v * 1_000_000),
}));

function Charts() {
  const fmt = (v: number) => `${(v / 1_000_000).toFixed(1)} mln`;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="space-y-2 p-4">
          <div className="text-caption text-muted-foreground">Sparkline · area / bar</div>
          <Sparkline values={[3, 5, 4, 7, 6, 9, 8]} />
          <Sparkline values={[3, 5, 4, 7, 6, 9, 8]} kind="bar" color="var(--chart-2)" />
        </Card>
        <Card className="p-4">
          <Gauge value={0.772} label="yig'ildi" />
        </Card>
      </div>
      <Card className="p-4">
        <DonutChart
          center="4.2"
          unit="mln so'm"
          emptyText="Ma'lumot yo'q"
          segments={[
            { label: "Ijara", value: 1_800_000, color: "var(--chart-1)", display: "1.8 mln" },
            { label: "Reklama", value: 1_200_000, color: "var(--chart-2)", display: "1.2 mln" },
            { label: "Kommunal", value: 700_000, color: "var(--chart-3)", display: "700 ming" },
            { label: "Boshqa", value: 500_000, color: "var(--chart-4)", display: "500 ming" },
          ]}
        />
      </Card>
      <Card className="p-4">
        <TrendChart
          points={TREND}
          series={[
            { key: "a", label: "Tushum", color: "var(--chart-1)" },
            { key: "b", label: "Chiqim", color: "var(--chart-2)" },
          ]}
          limit={{ label: "Reja", value: 22_000_000 }}
          formatValue={fmt}
          caption="Tushum va chiqim"
        />
      </Card>
    </div>
  );
}

function Cards() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard icon={<FolderKanban />} label="Faol loyihalar" value="24" tone={1} trend={{ value: "3", up: true }} />
        <StatCard icon={<Rocket />} label="Bugungi deploylar" value="12" tone={2} />
        <StatCard
          icon={<TriangleAlert />}
          label="Yiqilgan buildlar"
          value="2"
          tone={3}
          trend={{ value: "1", up: false }}
        />
        <StatCard icon={<Server />} label="Serverlar" value="5" tone={4} />
      </div>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Kartochka sarlavhasi</CardTitle>
            <CardDescription>Izoh matni</CardDescription>
          </div>
          <Badge tone="success" dot>
            Ishlayapti
          </Badge>
        </CardHeader>
        <CardContent className="text-body text-muted-foreground">Kartochka tanasi — 20px padding.</CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3 pt-5">
          <Meter label="CPU" value={0.32} detail="4 yadro" />
          <Meter label="Xotira (RAM)" value={0.81} detail="6.5 / 8 GB" />
          <Meter label="Disk" value={0.93} detail="93 / 100 GB" dangerAt={0.85} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-5">
          <LineChart
            caption="Namuna: CPU va xotira, 24 soat"
            times={demoMetrics.times}
            max={100}
            series={[
              { key: "cpu", label: "CPU", color: "var(--chart-1)", values: demoMetrics.cpu },
              { key: "mem", label: "Xotira", color: "var(--chart-2)", values: demoMetrics.mem },
            ]}
            formatValue={(v) => `${Math.round(v)}%`}
            formatTime={(t) => new Date(t).toISOString().slice(11, 16)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

const ROWS = [
  ["Bilim akademiyasi", "Aziza Karimova", "bilim.ventura.uz", "success", "Ishlayapti"],
  ["Zukko o'quv markazi", "Javohir Tursunov", "zukko.ventura.uz", "info", "Build"],
  ["Navoiy Taxta", "Botir Qodirov", "navoiytaxta.ventura.uz", "danger", "Yiqildi"],
] as const;

function DataTable() {
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState("all");
  const [range, setRange] = React.useState({ from: "2026-10-01", to: "2026-10-13" });
  return (
    <div className="space-y-4">
      <FilterBar standalone>
        <FilterSearch placeholder="Ism, telefon..." />
        <FilterDates
          from={range.from}
          to={range.to}
          onChange={(next) => setRange((r) => ({ ...r, ...next }))}
          fromLabel="Sanadan"
          toLabel="Sanagacha"
        />
        <FilterSelect
          label="Holat"
          value={status}
          onValueChange={setStatus}
          options={[
            { value: "all", label: "Holat (Hammasi)" },
            { value: "active", label: "Faol" },
            { value: "paused", label: "Muzlatilgan" },
          ]}
        />
        <FilterEnd>
          <span className="text-caption text-muted-foreground">37 ta yozuv</span>
        </FilterEnd>
      </FilterBar>
      <Card className="overflow-hidden">
        <TableWrap>
          <Table className="min-w-[520px]">
            <THead>
              <tr>
                <Th>Loyiha</Th>
                <Th>Domen</Th>
                <Th>Holat</Th>
                <Th className="text-right">Amallar</Th>
              </tr>
            </THead>
            <TBody>
              {ROWS.map(([name, client, domain, tone, label]) => (
                <Tr key={domain}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={name} size={32} />
                      <div>
                        <div className="text-body font-bold text-foreground">{name}</div>
                        <div className="text-caption text-muted-foreground">{client}</div>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <span className="font-mono text-primary-text">{domain}</span>
                  </Td>
                  <Td>
                    <Badge tone={tone} dot>
                      {label}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <Button variant="subtle" size="icon-sm" aria-label={`${name} amallari`}>
                      <MoreHorizontal />
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
        <Pagination page={page} pageCount={4} total={37} pageSize={10} onPageChange={setPage} />
      </Card>
    </div>
  );
}

function TabsDemo() {
  return (
    <Tabs defaultValue="b">
      <TabsList aria-label="Namuna">
        <TabsTrigger value="a">Umumiy</TabsTrigger>
        <TabsTrigger value="b">
          Bo&apos;limlar
          <span className="rounded-full bg-primary-soft px-2 py-0.5 font-mono text-caption font-semibold text-primary-text">
            4
          </span>
        </TabsTrigger>
        <TabsTrigger value="c">Domenlar</TabsTrigger>
        <TabsTrigger value="d" disabled>
          O&apos;chiq
        </TabsTrigger>
      </TabsList>
      <TabsContent value="a" className="text-body text-muted-foreground">
        Umumiy ma&apos;lumot.
      </TabsContent>
      <TabsContent value="b" className="text-body text-muted-foreground">
        Bo&apos;limlar ro&apos;yxati.
      </TabsContent>
      <TabsContent value="c" className="text-body text-muted-foreground">
        Domenlar ro&apos;yxati.
      </TabsContent>
    </Tabs>
  );
}

const STEPS = ["Mijoz", "Shablon", "Joylashtirish", "Brend", "Tekshirish"] as const;

function StepperDemo() {
  const [step, setStep] = React.useState(2);
  return (
    <div className="space-y-4">
      <Stepper steps={STEPS} current={step} onStepClick={setStep} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" disabled={step === 0} onClick={() => setStep(step - 1)}>
          Orqaga
        </Button>
        <Button size="sm" disabled={step === STEPS.length - 1} onClick={() => setStep(step + 1)}>
          Keyingi
        </Button>
      </div>
    </div>
  );
}

function Menus() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ProfileButton name="Saidakbar Saidov" role="Super admin" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuLabel>
            <div className="text-body font-bold text-foreground">Saidakbar Saidov</div>
            <div className="font-mono text-caption text-muted-foreground">admin@ventura.uz</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <User /> Profil
          </DropdownMenuItem>
          <DropdownMenuItem danger>
            <Trash2 /> Chiqish
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="subtle" size="icon-sm" aria-label="Amallar">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem>
            <ExternalLink /> Ochish
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Pencil /> Tahrirlash
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem danger>
            <Trash2 /> O&apos;chirish
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function Overlays() {
  const [drawer, setDrawer] = React.useState(false);
  const [center, setCenter] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);
  const [danger, setDanger] = React.useState(false);
  return (
    <div className="space-y-4">
      <Row label="Modallar">
        <Button onClick={() => setDrawer(true)}>O&apos;ngdan panel</Button>
        <Button variant="ghost" onClick={() => setCenter(true)}>
          Markaziy
        </Button>
        <Button variant="danger" onClick={() => setConfirm(true)}>
          Tasdiqlash
        </Button>
        <Button variant="danger" onClick={() => setDanger(true)}>
          Nomini yozib tasdiqlash
        </Button>
      </Row>
      <Row label="Toast">
        {(
          [
            ["success", "Saqlandi"],
            ["info", "Deploy boshlandi"],
            ["warning", "SSL tugashiga 14 kun qoldi"],
            ["danger", "Build yiqildi"],
          ] as const
        ).map(([tone, title]) => (
          <Button
            key={tone}
            variant="ghost"
            size="sm"
            onClick={() => toast({ tone, title, description: "Namuna xabar" })}
          >
            {tone}
          </Button>
        ))}
      </Row>

      <Modal
        open={drawer}
        onOpenChange={setDrawer}
        title="O'ngdan panel"
        description='position="right" (standart)'
        footer={
          <>
            <Button variant="ghost" onClick={() => setDrawer(false)}>
              Bekor qilish
            </Button>
            <Button onClick={() => setDrawer(false)}>Saqlash</Button>
          </>
        }
      >
        <div>
          <Label>Loyiha nomi</Label>
          <Input placeholder="Bilim akademiyasi" />
        </div>
      </Modal>
      <Modal
        open={center}
        onOpenChange={setCenter}
        position="center"
        title="Markaziy modal"
        description='position="center"'
        footer={<Button onClick={() => setCenter(false)}>Yopish</Button>}
      >
        <p className="text-body text-muted-foreground">Bosilgan tugmadan morph bo&apos;lib ochiladi.</p>
      </Modal>
      <ConfirmModal
        open={confirm}
        onOpenChange={setConfirm}
        title="Serverni o'chirasizmi?"
        message="uy-server-01 paneldan uziladi."
        onConfirm={() => toast({ tone: "danger", title: "Server uzildi" })}
      />
      <ConfirmModal
        open={danger}
        onOpenChange={setDanger}
        title="Loyihani butunlay o'chirasizmi?"
        message="Savatga o'tadi, 30 kundan keyin butunlay o'chadi."
        requireText="bilim"
        onConfirm={() => toast({ tone: "danger", title: "Loyiha savatga o'tkazildi" })}
      />
    </div>
  );
}

const DEMO_STEPS = [
  { key: "fetch", label: "Kodni olish", status: "ok", meta: "3 s" },
  { key: "build", label: "O'rnatish va build", status: "running" },
  { key: "release", label: "Yangi versiyaga o'tish", status: "pending" },
  { key: "health", label: "Tekshiruv", status: "pending" },
] as const;

const DEMO_FAILED = [
  { key: "build", label: "O'rnatish va build", status: "ok", meta: "48 s" },
  { key: "migrate", label: "Baza migratsiyasi", status: "failed", meta: "2 s" },
  { key: "release", label: "Yangi versiyaga o'tish", status: "skipped" },
] as const;

const DEMO_LOG = [
  { id: 1, kind: "info", text: "Sinov rejimi: buyruqlar bajarilmaydi." },
  { id: 2, kind: "cmd", text: "pnpm install --frozen-lockfile" },
  { id: 3, kind: "out", text: "Lockfile is up to date, resolution step is skipped" },
  { id: 4, kind: "out", text: "Packages: +612" },
  { id: 5, kind: "cmd", text: "pnpm db:migrate" },
  { id: 6, kind: "err", text: 'error: relation "students" already exists' },
] as const;

function Progress() {
  const [selected, setSelected] = React.useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Notice>Sinov rejimi: buyruqlar hech qaysi serverda bajarilmaydi.</Notice>
        <Notice tone="warning">Ishchi jarayon ishlamayapti — navbatdagi deploylar boshlanmaydi.</Notice>
        <Notice tone="danger">Baza migratsiyasi yiqildi: oldingi versiya ishlashda davom etmoqda.</Notice>
        <Notice tone="success">Deploy tayyor.</Notice>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <StepList steps={DEMO_STEPS} selected={selected} onSelect={setSelected} aria-label="Davom etayotgan" />
        <StepList steps={DEMO_FAILED} aria-label="Yiqilgan" />
      </div>
      <LogView lines={DEMO_LOG} live className="h-44" aria-label="Namuna log" />
    </div>
  );
}

function Identity() {
  return (
    <div className="flex flex-wrap items-center gap-6">
      <Logo subtitle="Boshqaruv paneli" />
      <Logo name="Bilim" subtitle="O'quv markaz" />
      <div className="flex items-center gap-2">
        {[24, 32, 40, 56].map((s) => (
          <Avatar key={s} name="Aziza Karimova" size={s} />
        ))}
        <Avatar name="Saidakbar Saidov" size={40} variant="brand" />
      </div>
    </div>
  );
}

export function UiCatalog() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-(--z-topbar) border-b border-(--topbar-border) bg-(--topbar-bg) [backdrop-filter:var(--topbar-blur)]">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <div className="mr-auto">
            <h1 className="type-heading text-lg leading-tight text-foreground">Komponentlar katalogi</h1>
            <p className="text-caption text-muted-foreground">
              @ventura/ui · har bir komponent light va dark rejimda · uslub: docs/design/STYLE.md
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/preview/ventura">
              <ArrowLeft /> Namunaviy ekran
            </Link>
          </Button>
          <ThemeToggle />
        </div>
        <nav className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:px-6">
          {SECTIONS.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="shrink-0 rounded-btn px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-12 px-4 py-8 sm:px-6">
        <Section
          id="ranglar"
          title="Ranglar"
          description="Brend rangi va undan hosil bo'ladiganlar, neytral va holat ranglari"
        >
          <Both>
            <Colors />
          </Both>
        </Section>
        <Section id="tipografiya" title="Tipografiya" description="Quicksand + JetBrains Mono, panel matn shkalasi">
          <Both>
            <Typography />
          </Both>
        </Section>
        <Section id="tugmalar" title="Tugmalar" description="Barchasi 12px radius; matnli tugmalarda 1px chegara">
          <Both>
            <Buttons />
          </Both>
        </Section>
        <Section id="inputlar" title="Inputlar" description="38px, 12px radius, fon = sahifa foni, 3px fokus halqasi">
          <Both>
            <Inputs />
          </Both>
        </Section>
        <Section id="tanlov" title="Tanlov" description="Checkbox, radio, switch, radio kartochka">
          <Both>
            <Choices />
          </Both>
        </Section>
        <Section id="badge" title="Badge" description="Holat ranglari: success, info, danger, warning, neutral">
          <Both>
            <Badges />
          </Both>
        </Section>
        <Section id="kartochkalar" title="Kartochkalar" description="Card, StatCard, Meter va LineChart">
          <Both>
            <Cards />
          </Both>
        </Section>
        <Section
          id="grafiklar"
          title="Grafiklar"
          description="Sparkline, DonutChart, Gauge va TrendChart (STYLE.md 11.32)"
        >
          <Both>
            <Charts />
          </Both>
        </Section>
        <Section
          id="jadval"
          title="Jadval"
          description="Filtr qatori (FilterBar), Table, Badge, uch nuqta va Pagination"
        >
          <Both>
            <DataTable />
          </Both>
        </Section>
        <Section id="tablar" title="Tablar" description="Aktiv tab ostida sirpanuvchi chiziq">
          <Both>
            <TabsDemo />
          </Both>
        </Section>
        <Section
          id="qadamlar"
          title="Qadamlar"
          description="Stepper: o'tilgan qadamga bosib qaytiladi; tor ekranda faqat joriy qadam"
        >
          <Both>
            <StepperDemo />
          </Both>
        </Section>
        <Section
          id="menyu"
          title="Menyu"
          description="Morph dropdown. Panel body'ga chiqadi, shuning uchun sahifaning umumiy temasida ochiladi."
        >
          <Both>
            <Menus />
          </Both>
        </Section>
        <Section
          id="topbar"
          title="Topbar"
          description="Sidebar to'liq ko'rinishi namunaviy ekranda (/preview/ventura)"
        >
          <Both className="overflow-hidden rounded-card border border-border">
            <Topbar onToggleSidebar={() => {}} brandSubtitle="Boshqaruv paneli" className="static">
              <ThemeToggle />
            </Topbar>
          </Both>
        </Section>
        <Section
          id="modal"
          title="Modal va toast"
          description="Bular body'ga chiqadi va umumiy temada ochiladi — dark ko'rinishi uchun tepadagi tema tugmasini bosing."
        >
          <div className="rounded-card border border-border bg-card p-5">
            <Overlays />
          </div>
        </Section>
        <Section
          id="jarayon"
          title="Jarayon va log"
          description="Notice, StepList va LogView — deploy holatini ko'rsatish uchun"
        >
          <Both>
            <Progress />
          </Both>
        </Section>
        <Section id="avatar" title="Avatar va logo">
          <Both>
            <Identity />
          </Both>
        </Section>
        <p className="pb-8 text-caption text-muted-foreground">
          Yangi komponent qo&apos;shilsa, shu sahifaga ham qo&apos;shing.
        </p>
      </main>
    </div>
  );
}
