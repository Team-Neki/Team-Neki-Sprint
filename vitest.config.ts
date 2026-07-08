import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// 순수 로직(zod validators, rich-content, 포맷터) 단위 테스트용 설정.
// Next.js/jsdom 은 끌어오지 않는다 — Node 환경에서 도는 import-safe 모듈만 테스트.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // tsconfig.json 의 paths("@/*" → "./src/*") 를 미러링.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
