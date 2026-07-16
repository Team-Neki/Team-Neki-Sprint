export type BranchPrefix = "feature" | "fix" | "chore";

/** 제목 -> 브랜치 slug: 소문자화, 영숫자만 남기고 하이픈으로, 양끝 하이픈 제거, 최대 40자. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

/** `prefix/KEY-slug`. slug 가 비면 `prefix/KEY`. */
export function buildBranchName(
  prefix: BranchPrefix,
  issueKey: string,
  title: string,
): string {
  const slug = slugify(title);
  return slug ? `${prefix}/${issueKey}-${slug}` : `${prefix}/${issueKey}`;
}
