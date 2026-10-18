# MCP 배포·응답 신뢰성 검증 오라클

계획: [MCP 배포·응답 신뢰성 개선](../plans/2026-10-18-mcp-release-reliability.md). 아래 항목은 구현 전에 정의했다. 완료 후 실행 결과와 근거를 각 항목에 기록한다. 외부 npm 게시 자체는 버전 변경이 있을 때 main 워크플로에서 일어나므로, 이번 검증은 게시 경로의 재현 가능한 검사와 현재 게시 버전 확인을 구분한다.

## A. 게시 패키지 연결

- [x] A1. `mcp` 빌드 산출물을 패키징한 뒤 실제 패키지 진입점으로 MCP `initialize`와 도구 목록 조회가 성공한다. **결과/근거:** `cd mcp && node scripts/smoke-package.mjs` → `@neki-team/sprint-mcp@0.4.1: initialize and 23 tools OK`
- [ ] A2. 게시 워크플로에서 새 버전을 게시한 뒤 레지스트리의 정확한 버전으로 같은 MCP 연결 검사를 수행한다. **결과/근거:** 첫 게시 실행 [39137599355](https://github.com/Team-Neki/Team-Neki-Sprint/actions/runs/39137599355)에서 `npm publish`는 성공했으나 npm이 패키지 처리 중이라고 알린 직후 설치가 `ETARGET`으로 실패. 전파 지연 대응 및 재실행 대기
- [x] A3. 게시 전 npm 버전과 레포 버전을 확인하고, 새 게시가 필요하지 않은 실행은 불필요하게 게시하지 않는다. **결과/근거:** 게시 전 npm 최신 `0.4.0` 확인; 워크플로의 `Decide whether to publish` 단계는 같은 버전이면 게시를 건너뛰고 스모크 검사만 실행함
- [x] A4. 새 코드의 패키지 버전은 게시 전 npm 버전보다 높고, `package.json`·`package-lock.json`의 버전이 일치한다. **결과/근거:** 두 파일 모두 `0.4.1`; 게시 전 npm 최신 버전은 `0.4.0`
- [x] A5. 게시 버전이 아직 보이지 않는 일시적 `ETARGET`만 제한적으로 재시도하고, 다른 오류는 즉시 실패한다. **결과/근거:** 실제 `0.4.1` 조회가 첫 4회 `ETARGET` 후 성공; 로컬 패키지와 게시 버전 모두 `initialize` 및 도구 23개 확인

## B. API 응답

- [x] B1. 정상 `{ ok: true, data }` 응답은 기존과 같은 값을 반환한다. **결과/근거:** `mcp/src/client.test.ts` 정상 응답 회귀 테스트 통과
- [x] B2. 2xx의 잘못된 JSON, 빈 응답, `ok`/`data` 누락은 성공으로 처리하지 않고 설명 가능한 오류를 던진다. **결과/근거:** 네 경우 모두 `ApiError`와 HTTP 200을 확인하는 테스트 통과
- [x] B3. 4xx/5xx의 기존 API 오류 설명과 HTTP 상태 전달이 유지된다. **결과/근거:** 422·500·403 회귀 테스트 통과

## C. 버전

- [x] C1. MCP `initialize`에서 보고하는 서버 버전이 `mcp/package.json`의 버전과 같다. **결과/근거:** 패키징 스모크 검사에서 서버 버전 `0.4.1` 일치 확인
- [x] C2. `mcp/src/index.ts`에 버전 문자열을 중복 하드코딩하지 않는다. **결과/근거:** `createRequire(import.meta.url)("../package.json")`에서 버전 로드

## D. 통합·범위

- [x] D1. `cd mcp && npm test && npm run build`가 통과한다. **결과/근거:** 테스트 4파일·19개 통과, TypeScript 빌드 성공
- [x] D2. 새 패키지 연결 검사를 로컬에서 재현하고 종료 코드 0을 확인한다. **결과/근거:** `node scripts/smoke-package.mjs` 종료 코드 0, 도구 23개
- [x] D3. `git diff --check`가 통과하고 변경 파일이 계획 범위 안에 있다. **결과/근거:** 종료 코드 0; 변경 대상은 계획·오라클·MCP 소스/테스트/패키지/게시 워크플로/스모크 스크립트
- [x] D4. `mcp/.omc/` 미추적 파일은 커밋에 포함되지 않는다. **결과/근거:** `git diff --cached --name-only`에 `mcp/.omc/` 없음; `git status --short`에서 별도 미추적 상태 확인
