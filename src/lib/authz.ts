/**
 * 인가(authorization) 헬퍼. 이 앱은 편집은 팀 전체에 개방하되, **파괴적 삭제**만
 * 소유자/작성자 또는 ADMIN 으로 제한한다(server action 게이트). 순수 함수라 테스트 가능.
 */

export type Actor = { id: string; role?: "ADMIN" | "MEMBER" | null };

/** ADMIN 이거나, 넘긴 소유자/작성자 id 중 하나가 actor 본인이면 관리(삭제) 가능. */
export function canManage(
  actor: Actor,
  ...ownerIds: (string | null | undefined)[]
): boolean {
  if (actor.role === "ADMIN") return true;
  return ownerIds.some((id) => !!id && id === actor.id);
}

/** 관리 권한이 없으면 throw. 삭제 계열 서버 액션 진입부 게이트로 사용. */
export function assertCanManage(
  actor: Actor,
  entityLabel: string,
  ...ownerIds: (string | null | undefined)[]
): void {
  if (!canManage(actor, ...ownerIds)) {
    throw new Error(
      `${entityLabel} 삭제 권한이 없습니다. 소유자 또는 관리자만 삭제할 수 있습니다.`,
    );
  }
}
