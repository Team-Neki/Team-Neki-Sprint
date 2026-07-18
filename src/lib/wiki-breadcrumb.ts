// 위키 페이지 브레드크럼(조상 경로) 계산 — 순수 로직이라 단위 테스트 가능. 폴더는
// 라우트가 없어 라벨만(href 없음), 조상 페이지는 링크. 현재 페이지는 제외(제목이 별도 노출).

export type WikiCrumb = { id: string; label: string; href?: string };

type CrumbPage = {
  id: string;
  title: string;
  parentId: string | null;
  folderId: string | null;
};
type CrumbFolder = { id: string; name: string; parentId: string | null };

/**
 * pageId 의 조상 경로를 [폴더…(root→leaf), 조상페이지…(root→parent)] 순으로 반환한다.
 * 페이지는 parentId 로 중첩되고(트리와 동일), 최상위 조상의 folderId 로 폴더 체인을 잇는다.
 * 순환/유실 데이터는 seen 가드로 안전 종료. 조상이 없으면 빈 배열(브레드크럼 미표시).
 */
export function buildWikiBreadcrumb(
  pageId: string,
  pages: CrumbPage[],
  folders: CrumbFolder[],
): WikiCrumb[] {
  const pageMap = new Map(pages.map((p) => [p.id, p]));
  const folderMap = new Map(folders.map((f) => [f.id, f]));

  // 페이지 부모 체인(현재 포함, 현재→루트).
  const pageChain: CrumbPage[] = [];
  const seenP = new Set<string>();
  let curP: string | null = pageId;
  while (curP) {
    if (seenP.has(curP)) break;
    seenP.add(curP);
    const p = pageMap.get(curP);
    if (!p) break;
    pageChain.push(p);
    curP = p.parentId;
  }
  if (pageChain.length === 0) return [];

  // 최상위 조상 페이지의 folderId 로 폴더 체인(leaf→root 로 모아 뒤집는다).
  const rootPage = pageChain[pageChain.length - 1];
  const folderCrumbs: WikiCrumb[] = [];
  const seenF = new Set<string>();
  let curF: string | null = rootPage.folderId;
  while (curF) {
    if (seenF.has(curF)) break;
    seenF.add(curF);
    const f = folderMap.get(curF);
    if (!f) break;
    folderCrumbs.push({ id: f.id, label: f.name || "제목 없음" });
    curF = f.parentId;
  }
  folderCrumbs.reverse();

  // 조상 페이지(현재 제외), root→parent.
  const pageCrumbs: WikiCrumb[] = pageChain
    .slice(1)
    .reverse()
    .map((p) => ({
      id: p.id,
      label: p.title || "제목 없음",
      href: `/wiki/${p.id}`,
    }));

  return [...folderCrumbs, ...pageCrumbs];
}
