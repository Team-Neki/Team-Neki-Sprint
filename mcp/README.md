# Sprint MCP 서버 (`@team-neki/sprint-mcp`)

Claude Code / Claude Desktop / Cursor 등 MCP 클라이언트에서 Sprint 트래커의 **티켓·위키**를
다루는 MCP 서버. 배포된 앱의 `/api/mcp/v1/*` HTTP API를 **개인 토큰(Bearer)** 으로 호출하는
얇은 클라이언트다. 모든 작업은 토큰 소유자 본인 계정으로 기록된다.

## 도구

| 도구 | 설명 |
|---|---|
| `create_ticket` | 티켓 생성. `team`=팀 key(예: `NEKI`) 또는 id, `assignee`=이메일 또는 id |
| `update_ticket` | 티켓 수정. `idOrKey`=cuid 또는 이슈키(`NEKI-42`), 준 필드만 변경 |
| `get_ticket` | 티켓 단건 조회 |
| `search_tickets` | 제목/키로 티켓 검색 |
| `create_wiki_page` | 위키 페이지 생성. `body`=마크다운(제목·목록·코드·굵게/기울임/링크) |
| `update_wiki_page` | 위키 제목/본문 수정(본문은 교체) |
| `get_wiki_page` | 위키 조회(순수 텍스트 + Tiptap JSON) |
| `search_wiki_pages` | 제목으로 위키 검색 |
| `list_teams` / `list_members` / `list_epics` | id 해석용 조회 보조 |

삭제 계열은 안전을 위해 노출하지 않는다.

## 1. 개인 토큰 발급

앱에 로그인한 뒤 우측 상단 **아바타 메뉴 → 프로필**(본인 프로필)로 이동해 하단
**API 토큰** 섹션에서 토큰을 만든다. 토큰 원문은 **생성 시 한 번만** 표시되므로 바로
복사해 둔다. 분실/유출 시 같은 화면에서 폐기한다.

## 2. 환경 변수

| 변수 | 값 |
|---|---|
| `SPRINT_API_URL` | 배포된 앱의 베이스 URL (예: `https://sprint.example.com`) |
| `SPRINT_API_TOKEN` | 위에서 발급한 `sprint_pat_...` 토큰 |

## 3-A. Claude Code (레포 클론 팀원)

레포 루트에 `.mcp.json`이 커밋돼 있어 프로젝트 MCP로 자동 인식된다.

```bash
cd mcp && npm install && npm run build && cd ..
export SPRINT_API_URL="https://<배포_도메인>"
export SPRINT_API_TOKEN="sprint_pat_..."
# Claude Code 재시작 → 프로젝트 MCP 서버 'sprint' 승인
```

`.mcp.json`은 `${SPRINT_API_URL}` / `${SPRINT_API_TOKEN}`을 셸 환경에서 확장한다. 토큰은 커밋하지 않는다.

## 3-B. Claude Desktop / Cursor (레포 없이)

npm에 게시된 패키지를 `npx`로 실행한다.

```jsonc
// Claude Desktop: claude_desktop_config.json
// Cursor: ~/.cursor/mcp.json
{
  "mcpServers": {
    "sprint": {
      "command": "npx",
      "args": ["-y", "@team-neki/sprint-mcp"],
      "env": {
        "SPRINT_API_URL": "https://<배포_도메인>",
        "SPRINT_API_TOKEN": "sprint_pat_..."
      }
    }
  }
}
```

> 게시 전에는 로컬 빌드 경로(`"command": "node", "args": ["<repo>/mcp/dist/index.js"]`)로도 등록할 수 있다.

## 개발

```bash
npm install
npm test        # vitest (config/client/format 순수 로직)
npm run build   # dist/ 로 컴파일
```

## 보안

- 토큰은 앱 DB에 sha-256 해시로만 저장되고 원문은 저장되지 않는다.
- 토큰은 발급 유저 스코프이며 언제든 폐기 가능하다.
- 엔드포인트는 세션 쿠키가 아니라 Bearer 토큰으로만 인증한다.
