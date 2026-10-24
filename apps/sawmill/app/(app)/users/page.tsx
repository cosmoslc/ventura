import { redirect } from "next/navigation";
import { can } from "@/lib/auth/roles";
import { requireUser } from "@/lib/server/session";
import { getUsersAction } from "./actions";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const { user } = await requireUser();
  if (!can(user.role, "users.view")) {
    redirect("/");
  }

  const initialUsers = await getUsersAction();

  return (
    <UsersClient
      initialUsers={initialUsers}
      currentUserId={user.id}
      canManage={can(user.role, "users.manage")}
      locale={user.locale}
    />
  );
}
