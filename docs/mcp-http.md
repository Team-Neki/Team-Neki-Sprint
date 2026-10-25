# Sprint Streamable HTTP MCP (초기 구현)

기존 Sprint Next.js 프로세스에 **`POST /api/mcp`** 를 추가합니다. 기존 `/api/mcp/v1/*`는 REST API로 계속 유지되고 Claude용 npm stdio MCP도 변경하지 않습니다.

## 범위

- JSON-RPC 2.0 기반 **stateless Streamable HTTP (JSON 응답)**: `initialize`, `ping`, `tools/list`, `tools/call`
- 현재 원격 도구는 `get_ticket`, `search_tickets`, `create_ticket`, `update_ticket` **4개만 제공**합니다. npm stdio MCP 전체 도구와 동등하지 않습니다.
- 요청마다 `Authorization: Bearer sprint_pat_...`를 검사합니다. 익명 도구 탐색도 허용하지 않습니다.
- 실제 CRUD 처리와 권한은 기존 `/api/mcp/v1/tasks` Route Handler에서 수행합니다.
- 서버 측 MCP 세션은 보관하지 않으므로 세션 종료를 위한 DELETE 및 서버 SSE 스트림은 지원하지 않습니다.

## 빠른 확인

Sprint 프로필 화면에서 사용자 PAT 발급 후 로컬 또는 staging 서버를 대상으로 실행합니다.

```bash
export SPRINT_URL="https://sprint.suitestudy.com:4641"
export SPRINT_API_TOKEN="sprint_pat_..."
curl -si "$SPRINT_URL/api/mcp" \
  -H "Authorization: Bearer $SPRINT_API_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"smoke","version":"1"}}}'
curl -si "$SPRINT_URL/api/mcp" \
  -H "Authorization: Bearer $SPRINT_API_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

기대: 두 요청 모두 200과 JSON-RPC `result`; 미인증 요청은 401. `GET /api/mcp`는 405.

## 인증 및 ChatGPT 연결 주의사항

이 구현은 Sprint PAT를 Authorization 헤더로 직접 전달할 수 있는 **MCP 클라이언트**에서 테스트할 수 있습니다. **ChatGPT의 커스텀 MCP 연결 화면이 PAT를 임의 Bearer 헤더로 전달할 수 있는지는 별도 검증이 필요합니다.** OAuth 기반 연결만 허용되는 환경이라면 OAuth 메타데이터·인가 서버 등 추가 구현이 필요합니다. 이 PR만으로 ChatGPT 실연동 완료를 주장하지 않습니다.

원격 MCP에는 쓰기 도구도 있으므로, 외부에 공개하기 전 요청별 인증, TLS, 남용 방지, 감사 및 레이트 리밋을 점검합니다. Next.js 런타임에서 별도 네트워크 요청 없이 기존 REST 핸들러를 직접 호출하는 구조입니다.

## 후속

- 기존 npm MCP와 도구 정의·스키마를 공통화하고 Epic/Project/Sprint/Wiki 도구를 단계적으로 이관
- 인증 방식에 맞는 ChatGPT 연결 및 실제 MCP Inspector 통합 테스트
- Streamable HTTP 프로토콜 전체 준수 검증 (버전 협상, 헤더 처리, 오류 및 배치 경계 사례)
