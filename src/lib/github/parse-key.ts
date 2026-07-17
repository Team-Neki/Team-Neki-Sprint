export type ParsedKey = { teamKey: string; number: number };

/**
 * 임의 문자열(브랜치명/PR제목)에서 태스크 키(TEAMKEY-NUMBER)를 찾는다.
 * teamKeys 는 워크스페이스의 모든 Team.key. 대소문자 무시 대조, 첫 매칭 반환(대문자 정규화).
 * 없으면 null.
 */
export function parseTaskKeyFromRef(
  ref: string,
  teamKeys: string[],
): ParsedKey | null {
  const known = new Set(teamKeys.map((k) => k.toUpperCase()));
  for (const m of ref.matchAll(/([A-Za-z][A-Za-z0-9]*)-(\d+)/g)) {
    const teamKey = m[1].toUpperCase();
    if (known.has(teamKey)) {
      return { teamKey, number: Number(m[2]) };
    }
  }
  return null;
}
