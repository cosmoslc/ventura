import { type StaffAccess, can, canAny } from "@ventura/auth/staff/policy";

export interface FinancePerms {
  view: boolean;
  create: boolean;
  edit: boolean;
  void: boolean;
  restore: boolean;
  correct: boolean;
  discount: boolean;
  receipt: boolean;
}

export function financePerms(access: StaffAccess): FinancePerms {
  return {
    view: canAny(access, [
      "finance.payment_view",
      "finance.payment_create",
      "finance.payment_edit",
      "finance.payment_delete",
    ]),
    create: can(access, "finance.payment_create"),
    edit: can(access, "finance.payment_edit"),
    void: can(access, "finance.payment_delete"),
    restore: canAny(access, ["finance.payment_delete", "archive.restore"]),
    correct: can(access, "students.balance_edit"),
    discount: can(access, "finance.payment_edit"),
    receipt: canAny(access, ["finance.payment_receipt_print", "finance.payment_create"]),
  };
}
