"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Editor } from "@tiptap/react";
import type { Status, Priority, SprintStatus } from "@prisma/client";
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
  renderSprintStatusOption,
} from "@/components/selects/option-select";
import {
  STATUS_ORDER,
  PRIORITY_ORDER,
  SPRINT_STATUS_ORDER,
} from "@/lib/constants";
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
import { updateSprintFields } from "@/server/actions/sprints";

export type DetailEntity = "task" | "epic" | "project" | "sprint";

/**
 * 엔티티마다 컬럼 이름이 달라, `type` 과 `field` 의 조합을 타입으로 묶어둔다.
 * 안 그러면 `type="task"` + `field="endDate"` 같은 조합이 컴파일을 통과하고,
 * 서버 zod 가 모르는 키를 조용히 버려 **에러 없이 저장이 안 되는** 상태가 된다
 * (`diffFields` 가 빈 patch 를 받아 그대로 반환 → 토스트도 안 뜬다).
 */
type NonSprint = Exclude<DetailEntity, "sprint">;
/** 제목: 스프린트만 `name`, 나머지는 `title`. */
type TitleTarget =
  | { type: "sprint"; field: "name" }
  | { type: NonSprint; field?: "title" };
/** 날짜: 스프린트만 기한이 `endDate`. */
type DateTarget =
  | { type: "sprint"; field: "startDate" | "endDate" }
  | { type: NonSprint; field: "startDate" | "dueDate" };
/** 숫자(MD): 스키마상 태스크에만 있다(에픽·프로젝트는 하위 롤업, 스프린트는 필드 자체가 없음). */
type NumberTarget = { type: "task"; field: "estimatedMd" | "actualMd" };

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
  sprint: updateSprintFields,
};

// 칩처럼 보이는 인라인 select 트리거: 보더 투명 + hover 시 인셋 면 노출(우측 정렬).
const chipTrigger =
  "h-7 gap-1 border-transparent bg-transparent px-1.5 shadow-none hover:bg-accent";

/**
 * 상세 인라인 편집 공용 훅: patch 저장 → 서버 확정 후 router.refresh.
 * `onError` 는 실패 시 호출된다 — 낙관적으로 먼저 보여준 값을 되돌리는 용도.
 */
function useFieldSave(type: DetailEntity, id: string) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function save(patch: Record<string, unknown>, onError?: () => void) {
    start(async () => {
      try {
        await UPDATE[type](id, patch);
        router.refresh();
      } catch {
        onError?.();
        toast.error("변경에 실패했습니다");
        router.refresh();
      }
    });
  }
  return { pending, save };
}

/**
 * 방금 고른 값을 서버 확정 전에 먼저 보여준다(낙관적 표시, BACKEND-53).
 *
 * 셀렉트류는 서버가 내려준 값을 그대로 렌더하는데, 저장 후 `router.refresh()` 가
 * route 전체를 다시 가져오기까지 수 초가 걸려 그 동안 트리거가 **옛 값 + 비활성**으로
 * 멈춰 있었다("안 눌렸나?" 하고 다시 눌러 중복 쓰기를 유발).
 *
 * React 19 `useOptimistic` 을 쓰지 않는 이유: 그쪽은 transition 이 끝나는 시점에 값을
 * 되돌리는데, refresh 가 느리면 서버 값이 도착하기 전에 되돌아가 한 번 깜빡인다.
 * 여기서는 **서버 값이 실제로 바뀐 것을 확인한 뒤** override 를 푼다(InlineTitle·
 * InlineDate·InlineNumber 가 이미 쓰던 prop 동기화 패턴을 훅으로 뽑은 것).
 *
 * null 도 유효한 값(미지정 등)이라 로컬 값은 박스에 담아 "override 없음"과 구분한다.
 */
function useOptimisticValue<T>(serverValue: T) {
  const [local, setLocal] = useState<{ v: T } | null>(null);
  const [prev, setPrev] = useState(serverValue);
  if (!Object.is(serverValue, prev)) {
    setPrev(serverValue);
    setLocal(null);
  }
  const show = (v: T) => setLocal({ v });
  const reset = () => setLocal(null);
  return [local ? local.v : serverValue, show, reset] as const;
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
  field = "title",
  className,
  href,
}: TitleTarget & {
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
    if (next !== value) save({ [field]: next });
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
  // 편집/읽기 모두 같은 flex 컨테이너로 감싼다 — 인풋만 반환하면 셀의 flex 컨테이너
  // 안에서 flex item 이 되어 `w-full` 이 shrink 에 밀려 폭이 줄어든다(편집 진입 시 축소 버그).
  if (editing)
    return <span className="flex min-w-0 flex-1 items-center">{input}</span>;
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
  const [shown, show, reset] = useOptimisticValue<string>(value);
  return (
    <OptionSelect<Status>
      value={shown}
      onValueChange={(v) => {
        show(v);
        save({ status: v as Status }, reset);
      }}
      options={STATUS_ORDER}
      getValue={(s) => s}
      renderOption={renderStatusOption}
      disabled={pending}
      size="sm"
      triggerClassName={chipTrigger}
    />
  );
}

/**
 * 스프린트 상태(SprintStatus). task/epic/project 의 Status 와 enum 이 달라
 * (PLANNED/ACTIVE/DONE) 별도 컴포넌트로 둔다 — 나머지 동작·모양은 InlineStatus 와 같다.
 */
export function InlineSprintStatus({
  id,
  value,
}: {
  id: string;
  value: SprintStatus;
}) {
  const { pending, save } = useFieldSave("sprint", id);
  const [shown, show, reset] = useOptimisticValue<string>(value);
  return (
    <OptionSelect<SprintStatus>
      value={shown}
      onValueChange={(v) => {
        show(v);
        save({ status: v as SprintStatus }, reset);
      }}
      options={SPRINT_STATUS_ORDER}
      getValue={(s) => s}
      renderOption={renderSprintStatusOption}
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
  const [shown, show, reset] = useOptimisticValue<string>(value);
  return (
    <OptionSelect<Priority>
      value={shown}
      onValueChange={(v) => {
        show(v);
        save({ priority: v as Priority }, reset);
      }}
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
  // 트리거는 options 에서 찾아 렌더하므로 낙관적 값도 id 문자열로 다룬다.
  const [shown, show, reset] = useOptimisticValue<string>(value?.id ?? UNASSIGNED);
  return (
    <OptionSelect<MiniUser>
      value={shown}
      onValueChange={(v) => {
        show(v);
        save({ [field]: v === UNASSIGNED ? null : v }, reset);
      }}
      options={members}
      getValue={(m) => m.id}
      getSearchText={(m) => `${m.name ?? ""} ${m.email}`}
      renderOption={renderMemberOption}
      renderTriggerOption={
        avatarOnly ? (m) => <UserBadge user={m} hideName /> : memberLabel
      }
      searchPlaceholder="담당자 검색"
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
  const [shown, show, reset] = useOptimisticValue<string>(value ?? NONE);
  return (
    <OptionSelect<{ id: string; label: string }>
      value={shown}
      onValueChange={(v) => {
        show(v);
        save({ [field]: v === NONE ? null : v }, reset);
      }}
      options={options}
      getValue={(o) => o.id}
      getSearchText={(o) => o.label}
      renderOption={(o) => o.label}
      searchPlaceholder={placeholder}
      placeholder={placeholder}
      leadingOption={{ value: NONE, label: noneLabel }}
      disabled={pending}
      size="sm"
      triggerClassName={cn(chipTrigger, "max-w-44")}
    />
  );
}

/* ---------- 날짜 ---------- */

const DATE_FIELD_LABEL = {
  startDate: "시작일",
  dueDate: "기한",
  endDate: "종료일",
} as const;

export function InlineDate({
  type,
  id,
  field,
  value,
}: DateTarget & {
  id: string;
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
      aria-label={DATE_FIELD_LABEL[field]}
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
}: NumberTarget & {
  id: string;
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
