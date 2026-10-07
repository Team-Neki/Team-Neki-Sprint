"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Role } from "@prisma/client";
import { OptionSelect } from "@/components/selects/option-select";
import { setUserRole } from "@/server/actions/teams";

const ROLES: readonly Role[] = ["ADMIN", "MEMBER"];
const ROLE_LABEL: Record<Role, string> = { ADMIN: "관리자", MEMBER: "멤버" };

/** 유저 한 명의 역할 인라인 select. 본인 행은 비활성(서버도 본인 변경을 거부한다). */
export function MemberRoleSelect({
  userId,
  role,
  self,
}: {
  userId: string;
  role: Role;
  self: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onChange(value: string) {
    if (value === role) return;
    start(async () => {
      try {
        await setUserRole(userId, value);
        router.refresh();
      } catch {
        toast.error("역할 변경에 실패했습니다");
      }
    });
  }

  return (
    <OptionSelect<Role>
      value={role}
      onValueChange={onChange}
      disabled={pending || self}
      options={ROLES}
      getValue={(r) => r}
      renderOption={(r) => ROLE_LABEL[r]}
      triggerClassName="w-24"
    />
  );
}
