import { create } from 'zustand';
import { fetchCodes, type CodeListResponse } from '@/shared/code/api/codeApi';
import { readStorage, removeStorage, writeStorage } from '@/shared/i18n/lang';

/**
 * 공통코드 캐시 — sys/code.md · backend/caching.md.
 *
 * <h2>왜 프론트에만 캐시가 있나</h2>
 *
 * <p>서버는 코드를 캐싱하지 않는다 — 조회가 인덱스 한 번이라 부하가 아니다. 문제인 것은
 * <b>한 화면이 콤보를 여러 개 띄울 때의 왕복</b>이고 그것은 여기서 푼다. 그래서 MASTER-02 의
 * <i>수정 즉시 반영</i> 이 서버 쪽에서는 구조적으로 성립하고, 어긋남은 <b>로그인 시점에</b>
 * 맞춘다(sys/code.md).
 *
 * <h2>저장 키가 하나다</h2>
 *
 * <p>메시지 번들과 갈리는 자리다. 저쪽은 언어 축이 붙어 `message:ko` · `message:en` 이지만
 * <b>코드에는 언어 축이 없다</b> — 담는 것이 코드값뿐이고 이름은 메시지 번들과 메모리에서
 * 조인하기 때문이다(sys/code.md). 그리고 버전이 `CACHE_NAME` 단위라 <b>그룹 하나가 바뀌어도
 * 코드 캐시 전체가 버려진다</b>(sys/code.md) — 버려지는 단위가 하나이므로 담는 단위도 하나다.
 *
 * <h2>그룹은 지연 로드, 요청은 한 번</h2>
 *
 * <p>적재는 <b>그룹별</b>이다(sys/code.md) — 화면이 쓰지 않는 그룹까지 받으면 코드가 늘수록
 * 첫 진입이 무거워진다. 대신 같은 틱에 뜬 콤보들의 그룹을 <b>마이크로태스크 하나로 모아</b>
 * 한 번에 묻는다: 콤보마다 부르면 캐시가 빈 첫 진입에서 왕복이 콤보 수만큼 난다.
 */
interface CodeCache {
  version: number;
  groups: Record<string, string[]>;
}

interface CodeState {
  /** 들고 있는 것이 어느 버전인가. `null` 이면 아직 아무것도 받지 않았다. */
  version: number | null;
  /** `GRP_CD → DTL_CD 목록`. <b>키가 있으면 받은 것</b>이며 빈 배열은 *비어 있다* 는 답이다. */
  groups: Record<string, string[]>;

  /**
   * 이 그룹들이 필요하다고 알린다 — <b>기다리지 않는다</b>.
   *
   * <p>이미 들고 있거나 요청 중인 그룹은 걸러진다. 받으면 스토어가 바뀌고 콤보가 다시
   * 그려진다 — 부르는 쪽이 `await` 로 렌더를 막으면 <b>콤보 하나 때문에 화면 전체가</b>
   * 늦어진다.
   */
  ensure: (grpCds: string[]) => void;

  /** 응답을 받는 자리 — 버전이 다르면 들고 있던 것을 함께 버린다. */
  accept: (response: CodeListResponse) => void;

  /**
   * 로그인·복원 응답을 받은 자리에서 부른다 — · sys/code.md.
   *
   * <p><b>왕복이 없다.</b> `cacheVersions.code` 는 이미 그 응답에 실려 오므로 비교는
   * 순수하게 로컬이다 — 그래서 로그인만이 아니라 F5 복원에서도 부른다.
   */
  syncWithSession: (codeVersion?: number) => void;
}

const CACHE_KEY = 'backoffice.code';

/** 아직 묻지 않은 그룹. 마이크로태스크가 이것을 비우며 한 번에 나간다. */
const pending = new Set<string>();
/** 지금 나가 있는 요청의 그룹 — 같은 그룹을 두 번 묻지 않는다. */
const inFlight = new Set<string>();
let scheduled = false;

export const useCodeStore = create<CodeState>((set, get) => ({
  ...hydrate(),

  ensure: (grpCds) => {
    const { groups } = get();
    let added = false;
    for (const grpCd of grpCds) {
      if (!grpCd || grpCd in groups || inFlight.has(grpCd) || pending.has(grpCd)) continue;
      pending.add(grpCd);
      added = true;
    }
    if (added) schedule();
  },

  accept: ({ version, groups }) => {
    // 버전이 다르면 들고 있던 것은 전부 낡았다 — 방금 받은 것만 남긴다(sys/code.md).
    const base = get().version === version ? get().groups : {};
    const next = { ...base, ...groups };
    write({ version, groups: next });
    set({ version, groups: next });
  },

  syncWithSession: (codeVersion) => {
    // 옛 서버는 이 키를 안 보낸다 — 판단할 근거가 없으면 들고 있는 것을 그대로 쓴다.
    if (codeVersion === undefined) return;
    if (get().version === codeVersion) return;

    removeStorage(CACHE_KEY);
    // 버전을 `codeVersion` 으로 적어 두지 않는다 — 그 버전의 데이터가 <b>하나도 없다</b>.
    // 적어 두면 다음 응답이 자기 것을 옛 데이터에 합치는 것으로 오해한다.
    set({ version: null, groups: {} });
  },
}));

function schedule(): void {
  if (scheduled) return;
  scheduled = true;
  // 같은 커밋에서 뜬 콤보들이 모두 `ensure` 를 부른 <b>뒤</b>에 나간다.
  queueMicrotask(() => {
    scheduled = false;
    void flush();
  });
}

async function flush(): Promise<void> {
  const grpCds = [...pending];
  pending.clear();
  if (grpCds.length === 0) return;

  grpCds.forEach((grpCd) => inFlight.add(grpCd));
  try {
    useCodeStore.getState().accept(await fetchCodes(grpCds));
  } catch {
    /*
      <b>빈 목록으로 굳히지 않는다.</b> 그러면 콤보가 영영 비어 있고 그 원인이 화면에
      드러나지 않는다 — 키를 넣지 않았으므로 다음에 그 콤보가 뜰 때 다시 묻는다.
    */
  } finally {
    grpCds.forEach((grpCd) => inFlight.delete(grpCd));
  }
}

/** 스토어를 만들 때 한 번 — 버전 대조는 로그인·복원이 뒤이어 한다. */
function hydrate(): Pick<CodeState, 'version' | 'groups'> {
  const cached = read();
  return cached ? { version: cached.version, groups: cached.groups } : { version: null, groups: {} };
}

function read(): CodeCache | null {
  const raw = readStorage(CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CodeCache;
    // 손상된 캐시를 믿으면 콤보가 조용히 빈다 — 없는 것으로 친다(메시지 번들과 같은 태도).
    return typeof parsed?.version === 'number' && parsed.groups && typeof parsed.groups === 'object'
      ? { version: parsed.version, groups: parsed.groups }
      : null;
  } catch {
    return null;
  }
}

function write(cache: CodeCache): void {
  writeStorage(CACHE_KEY, JSON.stringify(cache));
}
