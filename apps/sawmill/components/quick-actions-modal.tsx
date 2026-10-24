"use client";

import Link from "next/link";
import {
  Briefcase,
  DollarSign,
  Plus,
  TreePine,
  Truck,
  UserPlus,
  X,
} from "lucide-react";
import { type Locale, t } from "@/lib/i18n";

interface QuickActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: Locale;
}

export function QuickActionsModal({ isOpen, onClose, locale }: QuickActionsModalProps) {
  if (!isOpen) return null;

  const actions = [
    {
      label: t("quick_add_work", locale),
      href: "/work?action=new",
      icon: Briefcase,
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    {
      label: t("quick_add_dispatch", locale),
      href: "/dispatch?action=new",
      icon: Truck,
      color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: t("quick_add_cost", locale),
      href: "/teraks?action=cost",
      icon: DollarSign,
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    {
      label: t("quick_add_worker", locale),
      href: "/workers?action=new",
      icon: UserPlus,
      color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    },
    {
      label: t("quick_add_terak", locale),
      href: "/teraks?action=new",
      icon: TreePine,
      color: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-modal bg-card border border-border p-6 shadow-modal animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-btn bg-primary/10 text-primary flex items-center justify-center">
              <Plus className="size-4" />
            </div>
            <h2 className="text-title font-bold text-foreground">
              {t("quick_actions", locale)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-btn text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-4">
          {actions.map((act) => {
            const Icon = act.icon;
            return (
              <Link
                key={act.href}
                href={act.href}
                onClick={onClose}
                className="flex items-center gap-3 p-3 rounded-card border border-border hover:border-primary hover:bg-muted transition-all group"
              >
                <div className={`size-10 rounded-btn flex items-center justify-center ${act.color}`}>
                  <Icon className="size-5" />
                </div>
                <span className="text-caption font-semibold text-foreground group-hover:text-primary">
                  {act.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
