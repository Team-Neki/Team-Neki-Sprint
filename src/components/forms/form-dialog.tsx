"use client";

import { useState } from "react";
import type { Status, Priority } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusSelect, PrioritySelect } from "@/components/forms/fields";

/**
 * 엔티티 생성/수정 다이얼로그 공용 셸·필드 블록(2026-07-22 통합).
 * task/epic/project/sprint 4개 다이얼로그가 복붙하던 공통부를 한 곳으로 모은다 —
 * 다이얼로그 공통 수정(예: 모바일 잘림 대응)이 4곳에 따로 적용되며 생기던 drift 방지.
 * 엔티티 고유 필드·상태·submit 로직은 각 `*-dialog.tsx` 에 남는다.
 */

/**
 * 다이얼로그 셸. 폼 필드 state 는 `form` 렌더 프롭이 그리는 자식 컴포넌트에 둔다.
 * Base UI 는 닫히면 popup 하위를 언마운트하므로(keepMounted=false), 매 열림마다
 * 새로 마운트되어 폼이 항상 초기값으로 리셋된다(만들기=빈 폼, 수정=원본 값).
 * 최상위에 두면 열림 사이에 이전 입력이 그대로 남는다.
 */
export function FormDialog({
  trigger,
  form,
  contentClassName = "sm:max-w-lg",
}: {
  trigger: React.ReactElement;
  form: (onClose: () => void) => React.ReactNode;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className={contentClassName}>
        {form(() => setOpen(false))}
      </DialogContent>
    </Dialog>
  );
}

/** 라벨 + 컨트롤 세로 묶음. `min-w-0` 은 2열 행에서 셀렉트 오버플로 방지(gotchas). */
export function FormField({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/** 모바일 1열 → sm 2열 행. */
export function FormRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
  );
}

/** 제목(스프린트는 label="이름") 텍스트 입력. 항상 autoFocus. */
export function TitleField({
  value,
  onChange,
  placeholder,
  label = "제목",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <FormField label={label}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus
      />
    </FormField>
  );
}

/** 설명 textarea(3줄 기본). */
export function DescriptionField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <FormField label="설명">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={placeholder}
      />
    </FormField>
  );
}

/** 상태 + 우선순위 2열 행(task/epic/project 공용 — 스프린트는 SprintStatus 라 별도). */
export function StatusPriorityFields({
  status,
  onStatusChange,
  priority,
  onPriorityChange,
}: {
  status: Status;
  onStatusChange: (v: Status) => void;
  priority: Priority;
  onPriorityChange: (v: Priority) => void;
}) {
  return (
    <FormRow>
      <FormField label="상태">
        <StatusSelect value={status} onChange={onStatusChange} />
      </FormField>
      <FormField label="우선순위">
        <PrioritySelect value={priority} onChange={onPriorityChange} />
      </FormField>
    </FormRow>
  );
}

/** 시작일 + 종료일(태스크는 endLabel="마감일") 2열 행. 값은 `toDateInput` 문자열. */
export function DateRangeFields({
  start,
  onStartChange,
  end,
  onEndChange,
  endLabel = "종료일",
}: {
  start: string;
  onStartChange: (v: string) => void;
  end: string;
  onEndChange: (v: string) => void;
  endLabel?: string;
}) {
  return (
    <FormRow>
      <FormField label="시작일">
        <Input
          type="date"
          value={start}
          onChange={(e) => onStartChange(e.target.value)}
        />
      </FormField>
      <FormField label={endLabel}>
        <Input
          type="date"
          value={end}
          onChange={(e) => onEndChange(e.target.value)}
        />
      </FormField>
    </FormRow>
  );
}

/** 취소/저장 푸터. 저장 중엔 비활성 + "저장 중…" 표기. */
export function FormFooter({
  pending,
  onClose,
  onSubmit,
}: {
  pending: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <DialogFooter>
      <Button variant="outline" onClick={onClose}>
        취소
      </Button>
      <Button onClick={onSubmit} disabled={pending}>
        {pending ? "저장 중…" : "저장"}
      </Button>
    </DialogFooter>
  );
}
