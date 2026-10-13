import { type StaffAccess, can } from "@ventura/auth/staff/policy";

export interface LeadPerms {
  create: boolean;
  edit: boolean;
  delete: boolean;
  move: boolean;
  reassign: boolean;
  notes: boolean;
}

export function leadPerms(access: StaffAccess): LeadPerms {
  return {
    create: can(access, "leads.create"),
    edit: can(access, "leads.edit"),
    delete: can(access, "leads.delete"),
    move: can(access, "leads.status_change"),
    reassign: can(access, "leads.reassign"),
    notes: can(access, "leads.call_log"),
  };
}
