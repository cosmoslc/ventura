"use client";

import { Building2, Check, ChevronDown, Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ventura/ui/dropdown-menu";
import { cn } from "@ventura/ui/lib/utils";
import { uz } from "@/lib/uz";
import { selectBranchAction } from "./actions";

export interface PickerBranch {
  id: string;
  name: string;
  color: string;
  address: string | null;
}

/** Tepadagi filial tanlovi (eski tizimdagidek): "Barcha filiallar" yoki bitta filial. Tanlov serverda tekshiriladi. */
export function BranchPicker({ options, selected }: { options: PickerBranch[]; selected: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const current = options.find((b) => b.id === selected);

  function choose(value: string) {
    if (value === selected) return;
    startTransition(async () => {
      const res = await selectBranchAction(value);
      if (res.ok) router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={uz.branchPicker.choose}
          aria-busy={pending || undefined}
          className={cn(
            "flex h-(--control-h) min-w-0 items-center gap-2 rounded-btn border border-(--btn-ghost-border) bg-(--btn-ghost-bg) px-3 text-body font-semibold text-foreground",
            "transition-colors hover:border-(--btn-ghost-border-hover) hover:bg-(--btn-ghost-bg-hover)",
            pending && "opacity-60",
          )}
        >
          {current ? (
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: current.color }} aria-hidden />
          ) : (
            <Globe className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="max-w-40 truncate">{current?.name ?? uz.branchPicker.all}</span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{uz.branchPicker.title}</span>
          <span className="text-caption font-medium text-muted-foreground">
            {uz.branchPicker.count(options.length)}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => choose("all")}>
          <Globe />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{uz.branchPicker.all}</span>
            <span className="block text-caption text-muted-foreground">{uz.branchPicker.allHint}</span>
          </span>
          {selected === "all" ? <Check /> : null}
        </DropdownMenuItem>
        {options.map((b) => (
          <DropdownMenuItem key={b.id} onSelect={() => choose(b.id)}>
            <Building2 style={{ color: b.color }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{b.name}</span>
              {b.address ? (
                <span className="block truncate text-caption text-muted-foreground">{b.address}</span>
              ) : null}
            </span>
            {selected === b.id ? <Check /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
