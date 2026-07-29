import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Parallel worktree copies (see docs/gotchas.md §2).
    ".worktrees/**",
  ]),
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      // prisma 의 delete/update 는 대상 레코드가 없으면 P2025 를 던진다. `.catch(() => {})`
      // 로 삼켜도 **Prisma 가 예외 전에 `prisma:error` 를 먼저 출력**해 운영 로그가
      // 노이즈로 가득 찬다(위키 임시저장본 삭제에서 실제 발생, BACKEND-37).
      // 없을 수도 있는 레코드는 deleteMany/updateMany 로 지운다 — 0건이면 조용히 끝난다.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='catch'] > MemberExpression > CallExpression[callee.property.name=/^(delete|update)$/]",
          message:
            "prisma delete/update + .catch() 는 삼켜도 prisma:error 로그가 남습니다. 없을 수 있는 레코드는 deleteMany/updateMany 를 쓰세요.",
        },
      ],
    },
  },
]);

export default eslintConfig;
