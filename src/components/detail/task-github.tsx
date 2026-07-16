"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { GitBranch, Plus } from "lucide-react";
import { OptionSelect } from "@/components/selects/option-select";
import { buildBranchName, type BranchPrefix } from "@/lib/github/branch-name";
import {
  listInstallationRepos,
  createBranchForTask,
  type RepoOption,
} from "@/server/actions/github";

export type GithubLink = {
  id: string;
  repoFullName: string;
  branchName: string;
  branchUrl: string;
  prNumber: number | null;
  prState: string | null;
  prUrl: string | null;
};

const PREFIXES: BranchPrefix[] = ["feature", "fix", "chore"];

// PR 상태 배지: 기존 시맨틱 토큰만 사용(새 색 도입 금지, DESIGN.md).
const PR_BADGE: Record<string, string> = {
  OPEN: "bg-primary/10 text-primary",
  MERGED: "bg-primary/10 text-primary",
  CLOSED: "bg-muted text-muted-foreground",
};

export function TaskGithub({
  taskId,
  issueKey,
  title,
  links,
}: {
  taskId: string;
  issueKey: string;
  title: string;
  links: GithubLink[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [repos, setRepos] = useState<RepoOption[] | null>(null);
  const [repo, setRepo] = useState<string>();
  const [prefix, setPrefix] = useState<BranchPrefix>("feature");
  const [branchName, setBranchName] = useState(
    buildBranchName("feature", issueKey, title),
  );
  const [pending, start] = useTransition();

  async function openForm() {
    setOpen(true);
    if (repos) return;
    try {
      const list = await listInstallationRepos();
      setRepos(list);
      if (list[0]) setRepo(list[0].fullName);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "레포 목록을 불러오지 못했습니다",
      );
    }
  }

  function onPrefixChange(p: BranchPrefix) {
    setPrefix(p);
    setBranchName(buildBranchName(p, issueKey, title));
  }

  function submit() {
    if (!repo) {
      toast.error("레포를 선택하세요");
      return;
    }
    start(async () => {
      try {
        await createBranchForTask({
          taskId,
          repoFullName: repo,
          prefix,
          branchName,
          base: null,
        });
        toast.success("브랜치를 생성했습니다");
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "브랜치 생성에 실패했습니다",
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">GitHub</h3>
        <button
          type="button"
          onClick={openForm}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
        >
          <Plus className="size-3.5" /> 브랜치 생성
        </button>
      </div>

      {links.length === 0 ? (
        <p className="text-muted-foreground text-sm">연결된 브랜치가 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {links.map((l) => (
            <li
              key={l.id}
              className="border-border bg-card flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <GitBranch className="text-muted-foreground size-4 shrink-0" />
              <Link
                href={l.branchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate font-mono text-xs hover:underline"
              >
                {l.branchName}
              </Link>
              {l.prNumber !== null && l.prUrl && (
                <Link
                  href={l.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                    PR_BADGE[l.prState ?? "OPEN"] ?? ""
                  }`}
                >
                  #{l.prNumber} {l.prState}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="border-border flex flex-col gap-2 rounded-md border p-3">
          <span className="text-muted-foreground text-xs">레포</span>
          <OptionSelect
            value={repo}
            onValueChange={setRepo}
            options={repos ?? []}
            getValue={(r) => r.fullName}
            renderOption={(r) => (
              <span className="font-mono text-xs">{r.fullName}</span>
            )}
            placeholder={repos ? "레포 선택" : "불러오는 중…"}
          />
          <span className="text-muted-foreground text-xs">유형</span>
          <OptionSelect
            value={prefix}
            onValueChange={(v) => onPrefixChange(v as BranchPrefix)}
            options={PREFIXES}
            getValue={(p) => p}
            renderOption={(p) => <span>{p}</span>}
          />
          <span className="text-muted-foreground text-xs">브랜치명</span>
          <input
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            className="border-border bg-background rounded-md border px-2 py-1 font-mono text-xs"
          />
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground text-xs"
            >
              취소
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="bg-primary text-primary-foreground rounded-md px-2 py-1 text-xs disabled:opacity-50"
            >
              생성
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
