"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { createBranchSchema } from "@/lib/validators";
import { getActiveInstallation } from "@/server/github/installation";
import { githubFetch } from "@/lib/github/app";

export type RepoOption = { fullName: string; defaultBranch: string };

/** 설치에 접근 가능한 레포 목록(생성 폼 select 용). */
export async function listInstallationRepos(): Promise<RepoOption[]> {
  await requireUser();
  const inst = await getActiveInstallation();
  if (!inst) return [];
  const res = await githubFetch(
    inst.installationId,
    "/installation/repositories?per_page=100",
  );
  if (!res.ok) throw new Error(`레포 목록 조회 실패: ${res.status}`);
  const json = (await res.json()) as {
    repositories: { full_name: string; default_branch: string }[];
  };
  return json.repositories.map((r) => ({
    fullName: r.full_name,
    defaultBranch: r.default_branch,
  }));
}

/** 태스크에서 GitHub 브랜치 생성 후 링크 저장. */
export async function createBranchForTask(input: unknown) {
  const user = await requireUser();
  const data = createBranchSchema.parse(input);
  const inst = await getActiveInstallation();
  if (!inst) throw new Error("GitHub App 설치가 없습니다");

  const [owner, repo] = data.repoFullName.split("/");
  if (!owner || !repo) throw new Error("레포 형식이 올바르지 않습니다");

  // base 미지정 시 레포 default branch.
  let base = data.base ?? "";
  if (!base) {
    const repoRes = await githubFetch(
      inst.installationId,
      `/repos/${owner}/${repo}`,
    );
    if (!repoRes.ok) throw new Error(`레포 조회 실패: ${repoRes.status}`);
    base = ((await repoRes.json()) as { default_branch: string }).default_branch;
  }

  // base SHA.
  const refRes = await githubFetch(
    inst.installationId,
    `/repos/${owner}/${repo}/git/ref/heads/${base}`,
  );
  if (!refRes.ok) {
    throw new Error(`base 브랜치(${base}) 조회 실패: ${refRes.status}`);
  }
  const sha = ((await refRes.json()) as { object: { sha: string } }).object.sha;

  // 브랜치 생성.
  const createRes = await githubFetch(
    inst.installationId,
    `/repos/${owner}/${repo}/git/refs`,
    {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${data.branchName}`, sha }),
    },
  );
  if (createRes.status === 422) {
    throw new Error("같은 이름의 브랜치가 이미 있습니다");
  }
  if (!createRes.ok) throw new Error(`브랜치 생성 실패: ${createRes.status}`);

  const branchUrl = `https://github.com/${data.repoFullName}/tree/${data.branchName}`;
  await prisma.githubBranchLink.upsert({
    where: {
      repoFullName_branchName: {
        repoFullName: data.repoFullName,
        branchName: data.branchName,
      },
    },
    create: {
      taskId: data.taskId,
      repoFullName: data.repoFullName,
      branchName: data.branchName,
      branchUrl,
      createdById: user.id,
    },
    update: { taskId: data.taskId, createdById: user.id },
  });

  revalidatePath(`/tasks/${data.taskId}`);
  return { branchName: data.branchName, branchUrl };
}
