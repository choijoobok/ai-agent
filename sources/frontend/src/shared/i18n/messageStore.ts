import { create } from 'zustand';
import { fetchMessageBundle } from '@/shared/i18n/api/messageApi';
import {
  normalizeLang,
  readStorage,
  rememberLang,
  resolveLang,
  writeStorage,
  type Lang,
} from '@/shared/i18n/lang';

/**
 * 메시지 번들 — · sys/code.md.
 *
 * <p><b>`persist` 미들웨어를 쓰지 않는다.</b> 저장 키에 **언어 축**이 붙고(`message:ko`)
 * 버전과 함께 한 덩어리로 넣고 빼야 하는데, `persist` 는 스토어 하나에 키 하나다 — 언어를
 * 바꿀 때마다 옛 언어의 번들이 덮여 다음 접속에 전량을 다시 받는다.
 *
 * <p><b>실패해도 앱은 뜬다.</b> 캐시가 있으면 그것으로 가고, 없으면 `status: 'failed'` 이며
 * 그때 보이는 문구는 `src/locales` 의 정적 몇 개다. 키 문자열이 그대로 보이는 화면을
 * 내는 것보다 *"연결할 수 없습니다"* 가 정직하다.
 */
interface CachedBundle {
  version: number;
  /** 캐시에 함께 넣는다 — 세션 복원 경로는 서버를 부르지 않으므로 응답이 없다. */
  langs: string[];
  messages: Record<string, string>;
}

interface MessageState {
  lang: Lang;
  /** 지원 언어 전부 — 다국어 관리 화면의 하단 행 수를 정한다(screen/code/requirements.md). */
  langs: string[];
  version: number | null;
  messages: Record<string, string>;
  status: 'idle' | 'ready' | 'failed';

  /**
   * @param options.lang 서버가 아는 사용자 언어(`LOCALE_CD`). 없으면 브라우저가 정한다
   * @param options.verify 버전을 확인할지. 세션 복원 경로는 **확인하지 않는다** —
   *   `localStorage` 를 그대로 쓰고 없을 때만 받는다
   */
  load: (options?: { lang?: string; verify?: boolean }) => Promise<void>;

  /**
   * 로그인 응답을 받은 자리에서 부른다.
   *
   * <p>맞출 것이 둘이다. **언어**(`LOCALE_CD` 가 정본이며 다른 PC 의 첫 로그인이면 캐시와
   * 다르다)와 **버전**(`SYS_CACHE_VERSION`)이다. 둘 다 같으면 **아무 일도 하지 않는다** —
   * 로그인할 때마다 수천 건을 다시 받지 않는 것이 이 비교의 목적이다(sys/code.md).
   */
  syncWithSession: (localeCd?: string, messageVersion?: number) => Promise<void>;
}

const CACHE_PREFIX = 'backoffice.message:';

export const useMessageStore = create<MessageState>((set, get) => ({
  lang: resolveLang(),
  langs: [],
  version: null,
  messages: {},
  status: 'idle',

  load: async ({ lang: preferred, verify = true } = {}) => {
    const lang = preferred ? normalizeLang(preferred) : resolveLang();
    const cached = readCache(lang);

    if (!verify && cached) {
      apply(set, lang, cached);
      return;
    }

    try {
      let bundle = await fetchMessageBundle(lang, cached?.version);
      let effective = normalizeLang(bundle.lang);

      // 서버가 다른 언어를 골랐는데(ja → en) 버전만 비교해 unchanged 가 왔다면 그 캐시는
      // 다른 언어의 것이다 — 그대로 쓰면 영어 칸에 한국어가 들어간다. 다시 받는다.
      if (bundle.unchanged && effective !== lang) {
        bundle = await fetchMessageBundle(effective);
        effective = normalizeLang(bundle.lang);
      }

      const entry: CachedBundle =
        bundle.unchanged && cached
          // 본문은 캐시의 것이지만 언어 목록은 **방금 받은 것**이다 — 설정이 바뀌어 언어가
          // 늘어도 번들 버전은 그대로일 수 있고, 그러면 캐시의 옛 목록이 굳는다.
          ? { ...cached, langs: bundle.langs ?? cached.langs }
          : { version: bundle.version, langs: bundle.langs ?? [], messages: bundle.messages ?? {} };

      writeCache(effective, entry);
      apply(set, effective, entry);
    } catch {
      // 캐시가 있으면 낡은 문구라도 화면이 뜬다. 없으면 정적 폴백 화면이다.
      if (cached) {
        apply(set, lang, cached);
        return;
      }
      set({ lang, status: 'failed' });
    }
  },

  syncWithSession: async (localeCd, messageVersion) => {
    const current = get();
    const lang = normalizeLang(localeCd ?? current.lang);

    if (lang === current.lang && current.status === 'ready' && messageVersion === current.version) {
      return;
    }
    await current.load({ lang, verify: true });
  },
}));

function apply(
  set: (partial: Partial<MessageState>) => void,
  lang: Lang,
  bundle: CachedBundle,
): void {
  rememberLang(lang);
  set({
    lang,
    langs: bundle.langs ?? [],
    version: bundle.version,
    messages: bundle.messages,
    status: 'ready',
  });
}

function readCache(lang: Lang): CachedBundle | null {
  const raw = readStorage(CACHE_PREFIX + lang);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedBundle;
    // 손상된 캐시를 믿으면 화면 전체가 키 문자열이 된다 — 없는 것으로 친다.
    return typeof parsed?.version === 'number' && parsed.messages
      ? { ...parsed, langs: Array.isArray(parsed.langs) ? parsed.langs : [] }
      : null;
  } catch {
    return null;
  }
}

function writeCache(lang: Lang, bundle: CachedBundle): void {
  writeStorage(CACHE_PREFIX + lang, JSON.stringify(bundle));
}
