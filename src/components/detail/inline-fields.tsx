"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Editor } from "@tiptap/react";
import type { Status, Priority } from "@prisma/client";
import { Input } from "@/components/ui/input";
import {
  RichEditor,
  editorContentString,
} from "@/components/rich-text/rich-editor";
import { parseDoc } from "@/lib/rich-content";
import {
  OptionSelect,
  memberLabel,
  renderMemberOption,
  renderPriorityOption,
  renderStatusOption,
} from "@/components/selects/option-select";
import { STATUS_ORDER, PRIORITY_ORDER } from "@/lib/constants";
import { UserBadge, type MiniUser } from "@/components/user-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { toDateInput } from "@/components/forms/fields";
import { updateTaskFields } from "@/server/actions/tasks";
import { updateEpicFields } from "@/server/actions/epics";
import { updateProjectFields } from "@/server/actions/projects";

export type DetailEntity = "task" | "epic" | "project";

const UNASSIGNED = "__none__";
const NONE = "__none__";

// 엔티티별 단일 필드 patch 액션(diff 로깅은 서버에서 처리).
const UPDATE: Record<
  DetailEntity,
  (id: string, patch: Record<string, unknown>) => Promise<unknown>
> = {
  task: updateTaskFields,
  epic: updateEpicFields,
  project: updateProjectFields,
};

// 칩처럼 보이는 인라인 select 트리거: 보더 투명 + hover 시 인셋 면 노출(우측 정렬).
const chipTrigger =
  "h-7 gap-1 border-transparent bg-transparent px-1.5 shadow-none hover:bg-accent";

/** 상세 인라인 편집 공용 훅: patch 저장 → 서버 확정 후 router.refresh. */
function useFieldSave(type: DetailEntity, id: string) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function save(patch: Record<string, unknown>) {
    start(async () => {
      try {
        await UPDATE[type](id, patch);
        router.refresh();
      } catch {
        toast.error("변경에 실패했습니다");
        router.refresh();
      }
    });
  }
  return { pending, save };
}

/**
 * 필드 라벨 옆에 붙는 작은 도움말 아이콘. hover 시 툴팁으로 설명을 보여준다.
 * (예: MD 필드의 "1md=8h" 환산·산정 의미)
 */
export function FieldHint({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <TooltipProvider delay={150}>
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                aria-label="설명"
                className="text-muted-foreground/70 hover:text-muted-foreground inline-flex cursor-help"
              >
                <Info className="size-3" />
              </span>
            }
          />
          <TooltipContent className="flex flex-col gap-0.5 text-center">
            {hint}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  );
}

/** 메타 카드의 한 줄: 라벨(좌) + 편집 값(우). */
export function MetaRow({
  label,
  children,
  align = "center",
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  align?: "center" | "start";
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-2",
        align === "center" ? "items-center" : "items-start",
      )}
    >
      <span className="text-muted-foreground shrink-0 pt-1 text-xs">
        {label}
      </span>
      <div className="flex min-w-0 justify-end">{children}</div>
    </div>
  );
}

/* ---------- 제목(인라인 텍스트) ---------- */

export function InlineTitle({
  type,
  id,
  value,
  className,
  href,
}: {
  type: DetailEntity;
  id: string;
  value: string;
  /** 셀 등 좁은 곳에서 쓰기 위한 스타일 override(기본은 상세용 큰 제목). */
  className?: string;
  /**
   * 목록 셀용: 제공하면 클릭-투-에딧 모드가 된다. 기본은 제목 텍스트만 보이고
   * (글자 폭만큼), 텍스트를 클릭해야 열 길이만큼 확장된 인풋으로 편집한다. 텍스트
   * 우측의 빈 공간을 클릭하면 이 href(상세)로 소프트 내비 → 우측 슬라이드 상세.
   */
  href?: string;
}) {
  const { pending, save } = useFieldSave(type, id);
  const [text, setText] = useState(value);
  const [editing, setEditing] = useState(false);
  // 서버 확정값(prop)이 바뀌면(refresh 후) 로컬 편집값을 렌더 중 동기화(effect 미사용).
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setText(value);
  }

  function commit() {
    const next = text.trim();
    if (!next) {
      setText(value); // 빈 제목 불가 — 복원
      return;
    }
    if (next !== value) save({ title: next });
  }

  const input = (
    <input
      // 목록 클릭-투-에딧에서 편집 진입 시 바로 포커스.
      autoFocus={href ? editing : undefined}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        commit();
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          setText(value);
          e.currentTarget.blur();
        }
      }}
      disabled={pending}
      aria-label="제목"
      className={cn(
        "focus:bg-accent/50 -mx-1.5 w-full rounded-md px-1.5 py-0.5 text-2xl font-semibold tracking-tight outline-none disabled:opacity-60",
        className,
      )}
    />
  );

  // 상세 페이지(큰 제목): 항상 편집 가능한 인풋.
  if (!href) return input;
  // 목록 셀: 편집 중이면 열 길이만큼 인풋, 아니면 글자 폭 텍스트 + 우측 빈공간 상세 링크.
  if (editing) return input;
  return (
    <span className="flex min-w-0 flex-1 items-center">
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="클릭해서 제목 편집"
        className={cn(
          "hover:bg-accent min-w-0 truncate rounded px-1 py-0.5 text-left",
          className,
        )}
      >
        {value}
      </button>
      <Link
        href={href}
        scroll={false}
        aria-label="상세 열기"
        className="min-h-7 flex-1 self-stretch"
      />
    </span>
  );
}

/* ---------- 설명(인라인 리치 에디터, B6) ---------- */

export function InlineDescription({
  type,
  id,
  value,
}: {
  type: DetailEntity;
  id: string;
  value: string | null;
}) {
  const { save } = useFieldSave(type, id);
  // 에디터가 만들어내는 정규화된 초기 내용을 기준으로 삼아 blur 시 실변경만 저장.
  const baseline = useRef<string | null>(null);
  const editorRef = useRef<Editor | null>(null);

  // 실변경만 저장. explicit(Cmd/Ctrl+Enter)이면 저장 여부를 토스트로 알린다.
  function commit(editor: Editor, explicit = false) {
    const next = editorContentString(editor);
    if (next !== baseline.current) {
      baseline.current = next;
      save({ description: next });
      if (explicit) toast.success("저장했습니다");
    } else if (explicit) {
      toast("변경사항이 없습니다");
    }
  }

  return (
    <div className="focus-within:border-ring hover:border-input rounded-md border border-transparent px-2 py-1 transition-colors">
      <RichEditor
        initialContent={parseDoc(value)}
        placeholder="설명을 입력하세요… (#티켓, @사람, ⌘+Enter 저장)"
        onEditor={(editor) => {
          editorRef.current = editor;
          if (editor && baseline.current === null) {
            baseline.current = editorContentString(editor);
          }
        }}
        onBlur={(editor) => commit(editor)}
        // Cmd/Ctrl+Enter: 즉시 저장 + blur 로 편집 종료 피드백(문서 에디터와 동일 제스처).
        onSubmitShortcut={() => {
          const editor = editorRef.current;
          if (!editor) return;
          commit(editor, true);
          editor.commands.blur();
        }}
      />
    </div>
  );
}

/* ---------- 상태 / 우선순위 ---------- */

export function InlineStatus({
  type,
  id,
  value,
}: {
  type: DetailEntity;
  id: string;
  value: Status;
}) {
  const { pending, save } = useFieldSave(type, id);
  return (
    <OptionSelect<Status>
      value={value}
      onValueChange={(v) => save({ status: v as Status })}
      options={STATUS_ORDER}
      getValue={(s) => s}
      renderOption={renderStatusOption}
      disabled={pending}
      size="sm"
      triggerClassName={chipTrigger}
    />
  );
}

export function InlinePriority({
  type,
  id,
  value,
}: {
  type: DetailEntity;
  id: string;
  value: Priority;
}) {
  const { pending, save } = useFieldSave(type, id);
  return (
    <OptionSelect<Priority>
      value={value}
      onValueChange={(v) => save({ priority: v as Priority })}
      options={PRIORITY_ORDER}
      getValue={(p) => p}
      renderOption={renderPriorityOption}
      disabled={pending}
      size="sm"
      triggerClassName={chipTrigger}
    />
  );
}

/* ---------- 담당자 / 보고자(owner·assignee) ---------- */

export function InlineMember({
  type,
  id,
  field,
  value,
  members,
  placeholder = "미지정",
  avatarOnly = false,
}: {
  type: DetailEntity;
  id: string;
  field: "assigneeId" | "ownerId" | "reporterId";
  value: MiniUser | null;
  members: MiniUser[];
  placeholder?: string;
  /** 목록 셀 등 좁은 곳: 트리거를 이름 대신 담당자 아바타로(툴팁에 이름). */
  avatarOnly?: boolean;
}) {
  const { pending, save } = useFieldSave(type, id);
  return (
    <OptionSelect<MiniUser>
      value={value?.id ?? UNASSIGNED}
      onValueChange={(v) => save({ [field]: v === UNASSIGNED ? null : v })}
      options={members}
      getValue={(m) => m.id}
      renderOption={renderMemberOption}
      renderTriggerOption={
        avatarOnly ? (m) => <UserBadge user={m} hideName /> : memberLabel
      }
      placeholder={placeholder}
      leadingOption={{ value: UNASSIGNED, label: "미지정" }}
      disabled={pending}
      size="sm"
      triggerClassName={chipTrigger}
    />
  );
}

/* ---------- 엔티티 링크(에픽/프로젝트/스프린트) ---------- */

export function InlineLink({
  type,
  id,
  field,
  value,
  options,
  noneLabel = "없음",
  placeholder = "선택",
}: {
  type: DetailEntity;
  id: string;
  field: "epicId" | "projectId" | "sprintId";
  value: string | null;
  options: { id: string; label: string }[];
  noneLabel?: string;
  placeholder?: string;
}) {
  const { pending, save } = useFieldSave(type, id);
  return (
    <OptionSelect<{ id: string; label: string }>
      value={value ?? NONE}
      onValueChange={(v) => save({ [field]: v === NONE ? null : v })}
      options={options}
      getValue={(o) => o.id}
      renderOption={(o) => o.label}
      placeholder={placeholder}
      leadingOption={{ value: NONE, label: noneLabel }}
      disabled={pending}
      size="sm"
      triggerClassName={cn(chipTrigger, "max-w-44")}
    />
  );
}

/* ---------- 날짜 ---------- */

export function InlineDate({
  type,
  id,
  field,
  value,
}: {
  type: DetailEntity;
  id: string;
  field: "startDate" | "dueDate";
  value: Date | string | null;
}) {
  const { pending, save } = useFieldSave(type, id);
  const initial = toDateInput(value);
  // controlled + 서버 확정값 동기화(effect 미사용). defaultValue 사용 시
  // prop 변경마다 Base UI FieldControl 이 uncontrolled 경고를 낸다.
  const [text, setText] = useState(initial);
  const [prev, setPrev] = useState(initial);
  if (initial !== prev) {
    setPrev(initial);
    setText(initial);
  }
  return (
    <Input
      type="date"
      value={text}
      disabled={pending}
      onChange={(e) => {
        setText(e.target.value);
        if (e.target.value !== initial) save({ [field]: e.target.value });
      }}
      className="h-7 w-[8.5rem] border-transparent bg-transparent px-1.5 text-xs hover:border-input focus-visible:border-ring"
      aria-label={field === "startDate" ? "시작일" : "기한"}
    />
  );
}

/* ---------- 숫자(스토리포인트 / MD) ---------- */

export function InlineNumber({
  type,
  id,
  field,
  value,
  placeholder = "—",
  suffix,
}: {
  type: DetailEntity;
  id: string;
  field: "estimatedMd" | "actualMd";
  value: number | null;
  placeholder?: string;
  suffix?: string;
}) {
  const { pending, save } = useFieldSave(type, id);
  const asStr = value != null ? String(value) : "";
  const [text, setText] = useState(asStr);
  const [prev, setPrev] = useState(asStr);
  if (asStr !== prev) {
    setPrev(asStr);
    setText(asStr);
  }

  function commit() {
    if (text === asStr) return; // 서버 값과 동일 — 저장 생략
    save({ [field]: text === "" ? null : text });
  }

  return (
    <span className="inline-flex items-center gap-1">
      <Input
        type="text"
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value;
          // 숫자와 소수점 하나만 허용(스피너 없이 직접 입력).
          if (v === "" || /^\d*\.?\d*$/.test(v)) setText(v);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        // field-sizing:content 로 박스가 글자 폭만큼만(빈 값은 min-w 로 클릭영역 확보).
        // 좌측 정렬 → 타이핑 시 박스가 우측으로 자라고, 열 좌측선과 값이 맞는다.
        className="h-7 min-w-8 max-w-24 border-transparent bg-transparent px-1.5 text-left text-sm [field-sizing:content] hover:border-input focus-visible:border-ring"
        aria-label={field}
      />
      {suffix && <span className="text-muted-foreground text-xs">{suffix}</span>}
    </span>
  );
}
