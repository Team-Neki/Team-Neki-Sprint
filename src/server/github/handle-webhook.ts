import { prisma } from "@/lib/prisma";
import { parseTaskKeyFromRef } from "@/lib/github/parse-key";
import { prEventToStatus } from "@/lib/github/pr-status";

type Account = { login?: string };
type Installation = { id: number; account?: Account };
type Repository = { full_name: string };
type PullRequest = {
  number: number;
  title: string;
  html_url: string;
  merged: boolean;
  head: { ref: string };
};
export type GithubPayload = {
  action?: string;
  ref?: string;
  ref_type?: string;
  repository?: Repository;
  pull_request?: PullRequest;
  installation?: Installation;
};

async function allTeamKeys(): Promise<string[]> {
  const teams = await prisma.team.findMany({ select: { key: true } });
  return teams.map((t) => t.key);
}

async function findTaskId(
  teamKey: string,
  number: number,
): Promise<string | null> {
  const team = await prisma.team.findUnique({
    where: { key: teamKey },
    select: { id: true },
  });
  if (!team) return null;
  const task = await prisma.task.findUnique({
    where: { teamId_number: { teamId: team.id, number } },
    select: { id: true },
  });
  return task?.id ?? null;
}

/**
 * GitHub webhook 이벤트 처리. 모든 쓰기는 upsert(재전송 멱등).
 * installation: 설치 저장/삭제.
 * create(branch): 이름에 유효 키 있으면 자동연결(상태 변경 없음).
 * pull_request: 링크 upsert + PR 상태 + 태스크 자동 전이(open->IN_PROGRESS, merge->DONE).
 */
export async function handleGithubEvent(
  event: string,
  payload: GithubPayload,
): Promise<void> {
  if (event === "installation") {
    const inst = payload.installation;
    if (!inst) return;
    if (payload.action === "deleted") {
      await prisma.githubInstallation.deleteMany({
        where: { installationId: inst.id },
      });
    } else {
      await prisma.githubInstallation.upsert({
        where: { installationId: inst.id },
        create: {
          installationId: inst.id,
          accountLogin: inst.account?.login ?? "",
        },
        update: { accountLogin: inst.account?.login ?? "" },
      });
    }
    return;
  }

  if (event === "create" && payload.ref_type === "branch") {
    const repoFullName = payload.repository?.full_name;
    const branchName = payload.ref;
    if (!repoFullName || !branchName) return;
    const parsed = parseTaskKeyFromRef(branchName, await allTeamKeys());
    if (!parsed) return;
    const taskId = await findTaskId(parsed.teamKey, parsed.number);
    if (!taskId) return;
    const branchUrl = `https://github.com/${repoFullName}/tree/${branchName}`;
    await prisma.githubBranchLink.upsert({
      where: { repoFullName_branchName: { repoFullName, branchName } },
      create: { taskId, repoFullName, branchName, branchUrl },
      update: {},
    });
    return;
  }

  if (event === "pull_request") {
    const pr = payload.pull_request;
    const repoFullName = payload.repository?.full_name;
    if (!pr || !repoFullName) return;
    const branchName = pr.head.ref;
    const keys = await allTeamKeys();
    const parsed =
      parseTaskKeyFromRef(branchName, keys) ??
      parseTaskKeyFromRef(pr.title ?? "", keys);
    if (!parsed) return;
    const taskId = await findTaskId(parsed.teamKey, parsed.number);
    if (!taskId) return;

    // 제목만 바뀐 경우: prTitle 만 갱신.
    if (payload.action === "edited") {
      await prisma.githubBranchLink.updateMany({
        where: { repoFullName, branchName },
        data: { prTitle: pr.title },
      });
      return;
    }

    const outcome = prEventToStatus(payload.action ?? "", Boolean(pr.merged));
    if (!outcome) return;

    const branchUrl = `https://github.com/${repoFullName}/tree/${branchName}`;
    await prisma.githubBranchLink.upsert({
      where: { repoFullName_branchName: { repoFullName, branchName } },
      create: {
        taskId,
        repoFullName,
        branchName,
        branchUrl,
        prNumber: pr.number,
        prState: outcome.prState,
        prUrl: pr.html_url,
        prTitle: pr.title,
      },
      update: {
        prNumber: pr.number,
        prState: outcome.prState,
        prUrl: pr.html_url,
        prTitle: pr.title,
      },
    });

    if (outcome.taskStatus) {
      await prisma.task.update({
        where: { id: taskId },
        data: { status: outcome.taskStatus },
      });
    }
  }
}
