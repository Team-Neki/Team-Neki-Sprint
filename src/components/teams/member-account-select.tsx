"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { OptionSelect } from "@/components/selects/option-select";
import { setUserRole, setUserStatus } from "@/server/actions/teams";

type FieldDef = {
  options: readonly string[];
  labels: Record<string, string>;
  action: (userId: string, value: string) => Promise<unknown>;
  error: string;
};

/** 관리자가 멤버 배정 행에서 바꾸는 계정 필드. 옵션·라벨·서버 액션을 한 곳에 둔다. */
const FIELDS: Record<"role" | "status", FieldDef> = {
  role: {
    options: ["ADMIN", "MEMBER"],
    labels: { ADMIN: "관리자", MEMBER: "멤버" },
    action: setUserRole,
    error: "역할 변경에 실패했습니다",
  },
  status: {
    options: ["APPROVED", "PENDING"],
    labels: { APPROVED: "승인됨", PENDING: "승인 대기" },
    action: setUserStatus,
    error: "승인 상태 변경에 실패했습니다",
  },
};

/** 유저 한 명의 역할/승인 상태 인라인 select. 본인 행은 비활성(서버도 본인 변경을 거부한다). */
export function MemberAccountSelect({
  userId,
  field,
  value,
  self,
}: {
  userId: string;
  field: keyof typeof FIELDS;
  value: string;
  self: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const f = FIELDS[field];

  function onChange(next: string) {
    if (next === value) return;
    start(async () => {
      try {
        await f.action(userId, next);
        router.refresh();
      } catch {
        toast.error(f.error);
      }
    });
  }

  return (
    <OptionSelect<string>
      value={value}
      onValueChange={onChange}
      disabled={pending || self}
      options={f.options}
      getValue={(v) => v}
      renderOption={(v) => f.labels[v]}
      triggerClassName="w-24"
    />
  );
}
