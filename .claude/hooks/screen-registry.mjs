/** screenRegistry.ts의 정적 import를 화면 경로와 실제 소스 폴더로 푼다. */

/**
 * 과도기 `src/features/**`와 제품 모듈 `src/modules/{제품}/features/**`를 같은 계약으로 읽는다.
 * 동적 import만 허용하는 레지스트리 규약 덕분에 별도 목록을 만들지 않는다.
 */
export function parseScreenRegistry(source) {
  const pattern =
    /'(\/[^']*)':[\s\S]{0,400}?await import\('@\/((?:features|modules\/[^/'"]+\/features)\/(.+?))\/pages\//g;
  return [...source.matchAll(pattern)].map((match) => ({
    url: match[1],
    sourceDir: match[2],
    feature: match[3],
  }));
}

/** 바뀐 프론트 파일을 가장 구체적인 레지스트리 소스 폴더의 화면으로 돌린다. */
export function screenUrlOfFrontend(changed, screens) {
  const prefix = 'sources/frontend/src/';
  if (!changed.startsWith(prefix)) return null;
  const tail = changed.slice(prefix.length);
  let best = null;
  for (const screen of screens) {
    if (
      tail.startsWith(`${screen.sourceDir}/`) &&
      (!best || screen.sourceDir.length > best.sourceDir.length)
    ) {
      best = screen;
    }
  }
  return best?.url ?? null;
}

