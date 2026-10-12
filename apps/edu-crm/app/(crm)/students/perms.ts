import { type StaffAccess, can } from "@ventura/auth/staff/policy";
import type { StudentPerms } from "./student-dialogs";

export function studentPerms(access: StaffAccess): StudentPerms {
  return {
    create: can(access, "students.create"),
    edit: can(access, "students.edit"),
    freeze: can(access, "students.freeze"),
    delete: can(access, "students.delete"),
  };
}
