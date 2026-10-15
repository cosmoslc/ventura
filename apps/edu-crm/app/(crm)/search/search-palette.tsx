"use client";

import { GraduationCap, IdCard, Target, UserPlus, Users, UsersRound, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { type CommandGroup, CommandPalette } from "@ventura/ui/command-palette";
import { SEARCH_KINDS, SEARCH_MIN, type SearchHit, type SearchKind } from "@/lib/search";
import { uz } from "@/lib/uz";
import { QUICK_PARAM } from "../use-quick-open";
import { globalSearchAction } from "./actions";

const t = uz.search;
const DEBOUNCE_MS = 250;

const KIND_ICON: Record<SearchKind, React.ReactNode> = {
  student: <GraduationCap />,
  lead: <Target />,
  group: <UsersRound />,
  teacher: <Users />,
  staff: <IdCard />,
};

/** Tezkor amal turi → ikonka; ro'yxatni server beradi (ruxsat va bo'lim yoqilganiga qarab) */
export type QuickKind = "student" | "lead" | "payment";
export interface QuickAction {
  kind: QuickKind;
  href: string;
}
const QUICK: Record<QuickKind, { label: string; icon: React.ReactNode }> = {
  student: { label: t.newStudent, icon: <UserPlus /> },
  lead: { label: t.newLead, icon: <Target /> },
  payment: { label: t.receivePayment, icon: <Wallet /> },
};

interface Found {
  q: string;
  hits: SearchHit[];
  error: boolean;
}

/**
 * Global qidiruv va tezkor amallar (E6h): Ctrl/Cmd+K yoki yuqori paneldagi maydon/ikonka bilan ochiladi.
 * So'rov 250 ms to'xtagach serverga ketadi (eskirgan javob e'tiborga olinmaydi).
 */
export function SearchPalette({
  open,
  onOpenChange,
  quick,
  search = globalSearchAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quick: QuickAction[];
  /** Qidiruv amali (standart — haqiqiysi); ko'rinish sahifasi o'zinikini beradi */
  search?: typeof globalSearchAction;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [found, setFound] = React.useState<Found | null>(null);
  const trimmed = query.trim();
  const searchable = trimmed.length >= SEARCH_MIN;

  // Ctrl/Cmd+K — ochish yoki yopish
  const toggle = React.useEffectEvent(() => onOpenChange(!open));
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    if (!open || !searchable) return;
    let stale = false;
    const timer = setTimeout(() => {
      search(trimmed)
        .then((res) => !stale && setFound({ q: trimmed, hits: res.ok ? res.hits : [], error: !res.ok }))
        .catch(() => !stale && setFound({ q: trimmed, hits: [], error: true }));
    }, DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [open, searchable, trimmed, search]);

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setQuery("");
      setFound(null);
    }
  }

  function go(href: string) {
    close(false);
    router.push(href);
  }

  // Yangi javob kelguncha oldingisi ko'rinib turadi (miltillamasin)
  const current = searchable ? found : null;
  const loading = searchable && found?.q !== trimmed;
  const needle = trimmed.toLowerCase();

  const groups: CommandGroup[] = [];
  for (const kind of SEARCH_KINDS) {
    const items = (current?.hits ?? []).filter((h) => h.kind === kind);
    if (items.length)
      groups.push({
        id: kind,
        label: t.kinds[kind]!,
        items: items.map((h) => ({
          id: `${h.kind}:${h.id}`,
          title: h.title,
          subtitle: h.subtitle,
          icon: KIND_ICON[kind],
          onSelect: () => go(h.href),
        })),
      });
  }
  const actions = quick
    .map((a) => ({ a, ...QUICK[a.kind] }))
    .filter((x) => !needle || x.label.toLowerCase().includes(needle))
    .map((x) => ({
      id: `quick:${x.a.kind}`,
      title: x.label,
      icon: x.icon,
      onSelect: () => go(`${x.a.href}?${QUICK_PARAM}=1`),
    }));
  if (actions.length) {
    const group = { id: "quick", label: t.quick, items: actions };
    // So'rov yozilmaganda tezkor amallar tepada, yozilganda natijalardan keyin
    if (searchable) groups.push(group);
    else groups.unshift(group);
  }

  const message = loading
    ? t.searching
    : current?.error
      ? t.error
      : searchable
        ? t.empty
        : trimmed
          ? t.tooShort
          : t.hint;

  return (
    <CommandPalette
      open={open}
      onOpenChange={close}
      title={t.title}
      description={t.description}
      placeholder={t.placeholder}
      query={query}
      onQueryChange={setQuery}
      groups={groups}
      message={message}
    />
  );
}
