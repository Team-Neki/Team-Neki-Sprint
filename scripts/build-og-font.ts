/**
 * OG 공유 이미지용 Pretendard 서브셋 폰트를 만든다.  실행: `npm run og:font`
 *
 * 왜 서브셋인가: satori(next/og)의 기본 폰트에는 한글 글리프가 없어서 한국어를 쓰려면
 * 폰트를 직접 먹여야 하는데, Pretendard 원본은 웨이트당 2.7MB 라 레포에 넣기엔 크다.
 * 이미지 문구(`src/lib/og.ts` 의 OG_TEXTS)에 실제로 쓰인 글자만 남기면 수 KB로 준다.
 *
 * 필요 도구: uv(uvx). fonttools 는 uvx 가 알아서 받는다.
 *   brew install uv
 *
 * 하는 일:
 *   1. Pretendard 릴리스 zip 을 받아(캐시) Regular/SemiBold TTF 추출
 *   2. OG_TEXTS 의 글자만 남겨 assets/fonts/ 에 서브셋 저장
 *   3. src/lib/og.ts 의 OG_FONT_GLYPHS 를 방금 쓴 글자 목록으로 갱신
 *
 * 원본 TTF 는 레포에 커밋하지 않는다(캐시 디렉터리에만 둔다).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { OG_TEXTS, uniqueGlyphs } from "../src/lib/og.js";

const PRETENDARD_VERSION = "1.3.9";
const ZIP_URL = `https://github.com/orioncactus/pretendard/releases/download/v${PRETENDARD_VERSION}/Pretendard-${PRETENDARD_VERSION}.zip`;

const ROOT = path.resolve(import.meta.dirname, "..");
const CACHE = path.join(ROOT, "node_modules/.cache/og-font");
const OUT_DIR = path.join(ROOT, "assets/fonts");

// 릴리스 zip 안의 경로. static/ 은 OTF, static/alternative/ 가 TTF 판이다.
const WEIGHTS = [
  { file: "Pretendard-Regular.ttf", out: "Pretendard-Regular.subset.ttf" },
  { file: "Pretendard-SemiBold.ttf", out: "Pretendard-SemiBold.subset.ttf" },
];

function run(cmd: string, args: string[], cwd?: string) {
  execFileSync(cmd, args, { cwd, stdio: "inherit" });
}

function fetchSources() {
  mkdirSync(CACHE, { recursive: true });
  const zip = path.join(CACHE, `Pretendard-${PRETENDARD_VERSION}.zip`);
  if (!existsSync(zip)) {
    console.log(`Pretendard ${PRETENDARD_VERSION} 내려받는 중...`);
    run("curl", ["-sL", "--fail", "-o", zip, ZIP_URL]);
  }
  const members = WEIGHTS.map((w) => `public/static/alternative/${w.file}`);
  run("unzip", ["-o", "-q", zip, ...members, "LICENSE.txt", "-d", CACHE]);
}

function subset(glyphs: string) {
  mkdirSync(OUT_DIR, { recursive: true });
  const textFile = path.join(CACHE, "glyphs.txt");
  writeFileSync(textFile, glyphs, "utf8");

  for (const w of WEIGHTS) {
    const input = path.join(CACHE, "public/static/alternative", w.file);
    const output = path.join(OUT_DIR, w.out);
    run("uvx", [
      "--from",
      "fonttools",
      "pyftsubset",
      input,
      `--text-file=${textFile}`,
      `--output-file=${output}`,
      "--no-hinting",
      "--desubroutinize",
      "--drop-tables+=DSIG",
    ]);
    const kb = (readFileSync(output).byteLength / 1024).toFixed(1);
    console.log(`  ${w.out}  ${kb} KB`);
  }

  // OFL 1.1 은 저작권/라이선스 고지 동봉을 요구한다.
  const license = readFileSync(path.join(CACHE, "LICENSE.txt"));
  writeFileSync(path.join(OUT_DIR, "Pretendard-LICENSE.txt"), license);
}

/** src/lib/og.ts 의 OG_FONT_GLYPHS 리터럴을 실제 서브셋 글자로 덮어쓴다. */
function syncGlyphConstant(glyphs: string) {
  const file = path.join(ROOT, "src/lib/og.ts");
  const source = readFileSync(file, "utf8");
  const pattern = /(export const OG_FONT_GLYPHS = )("(?:[^"\\]|\\.)*")(;)/;
  if (!pattern.test(source)) {
    throw new Error("src/lib/og.ts 에서 OG_FONT_GLYPHS 선언을 찾지 못했다.");
  }
  const next = source.replace(pattern, `$1${JSON.stringify(glyphs)}$3`);
  if (next !== source) {
    writeFileSync(file, next);
    console.log("src/lib/og.ts 의 OG_FONT_GLYPHS 갱신됨");
  }
}

const glyphs = uniqueGlyphs(OG_TEXTS);
console.log(`서브셋 글자 ${[...glyphs].length}개: ${glyphs}`);
fetchSources();
subset(glyphs);
syncGlyphConstant(glyphs);
console.log("완료.");
