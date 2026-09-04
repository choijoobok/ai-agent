/**
 * 이 브라우저가 볼 언어를 정한다.
 *
 * <p><b>순위는 둘로 끝난다.</b> `localStorage` 의 직전 언어, 그리고 `navigator.language` 의
 * 언어 부분이다. *"서버 기본 언어"* 를 3순위로 두지 않는 이유는 2순위가 **모든 경우를 닫기**
 * 때문이다 — 지원 언어가 둘이므로 *"한국어이거나 영어"* 밖에 없다.
 *
 * <p><b>같은 규칙이 서버에도 있다</b>(`RequestLocale.normalize`). 중복처럼 보이지만 피할 수
 * 없다 — 프론트는 **첫 요청을 보내기 전에** 언어를 정해야 하고(`?lang=`), 서버는 세션이 없는
 * 요청의 에러 문구를 그 힌트로 만들어야 한다. 둘 다 *"ko 로 시작하면 ko, 그 밖은 전부 en"*
 * 한 줄로 접힌다.
 *
 * <p>지원 목록의 원본은 공통코드(`LANG_CD` 그룹)이며(sys/code.md) 그 테이블은 기준정보 슬라이스의
 * 것이다. 늘어나면 여기와 서버 설정을 함께 고친다.
 */
export const SUPPORTED_LANGS = ['ko', 'en'] as const;

export type Lang = (typeof SUPPORTED_LANGS)[number];

/** 지원하지 않는 브라우저 언어의 답. **번역 폴백 언어(ko)와 다른 축이다** — sys/code.md. */
export const BROWSER_FALLBACK_LANG: Lang = 'en';

const LANG_STORAGE_KEY = 'backoffice.lang';

export function normalizeLang(raw: string | null | undefined): Lang {
  if (!raw) return BROWSER_FALLBACK_LANG;
  const language = raw.replace('_', '-').split('-')[0].toLowerCase();
  return (SUPPORTED_LANGS as readonly string[]).includes(language)
    ? (language as Lang)
    : BROWSER_FALLBACK_LANG;
}

/**
 * 번들을 받기 전에 부른다 — 그래서 **동기여야 하고 실패하면 안 된다**.
 *
 * <p>사생활 보호 모드에서 `localStorage` 접근 자체가 던진다. 여기서 던지면 앱이 흰 화면으로
 * 죽으므로 삼키고 브라우저 언어로 간다.
 */
export function resolveLang(): Lang {
  const remembered = readStorage(LANG_STORAGE_KEY);
  if (remembered) return normalizeLang(remembered);
  return normalizeLang(navigator.language);
}

/** 다음 접속의 1순위가 된다. 로그인하면 `LOCALE_CD` 가 정본이므로 그 값으로 다시 쓴다. */
export function rememberLang(lang: Lang): void {
  writeStorage(LANG_STORAGE_KEY, lang);
}

export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 저장하지 못해도 이번 세션은 정상 동작한다 — 다음 접속에 브라우저 언어로 돌아갈 뿐이다.
  }
}

/**
 * 캐시를 버리는 쪽 — sys/code.md 이 <i>"달라진 것만 버린다"</i> 고 한 그 <b>버린다</b>.
 *
 * <p>빈 문자열을 쓰지 않는다. 그러면 읽는 쪽마다 <i>"없다"</i> 와 <i>"비었다"</i> 를 가르는
 * 규칙이 따로 생기고, 그 둘이 어긋나면 <b>못 지운 캐시가 지운 척</b>한다.
 */
export function removeStorage(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // 읽기와 같은 이유로 삼킨다 — 사생활 보호 모드에서는 접근 자체가 던진다.
  }
}
