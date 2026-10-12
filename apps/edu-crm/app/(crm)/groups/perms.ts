import { type StaffAccess, can } from "@ventura/auth/staff/policy";
import type { GroupPerms } from "./groups-view";

export function groupPerms(access: StaffAccess): GroupPerms {
  return {
    create: can(access, "groups.create"),
    edit: can(access, "groups.edit"),
    delete: can(access, "groups.delete"),
    changeTeacher: can(access, "groups.change_teacher"),
    addStudent: can(access, "groups.add_student"),
    removeStudent: can(access, "groups.remove_student"),
    freeze: can(access, "students.freeze"),
  };
}
