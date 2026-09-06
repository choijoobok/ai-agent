import { create } from 'zustand';
import type { MenuNode } from '@/shared/authz/menuTree';

/** 세션 주체 — 서버가 로그인·복원 응답으로 준다. */
export interface AuthUser {
  userId: string;
  userNm: string;
  localeCd: string;
}

/**
 * 날짜 표시 형식 셋 — frontend/grid.md 의 정밀도 표와 1:1 이다.
 *
 * <p>{@code dayjs} 의 형식 문자열이다. 구분자를 바꾸는 것이 이 설정의 첫 용도이며
 * (`YYYY.MM.DD`), 자릿수 자체를 바꾸는 것은 <b>컬럼 선언의 일</b>이다 — 정밀도를 설정으로
 * 두면 년월 컬럼이 있는 화면과 없는 화면이 같은 값을 다르게 읽는다.
 */
export interface DateFormat {
  /** 년월 — `YYYY-MM`. */
  month: string;
  /** 년월일 — `YYYY-MM-DD`. `date` 타입의 기본이다. */
  day: string;
  /** 년월일시분초 — `YYYY-MM-DD HH:mm:ss`. `dateTime` 타입의 기본이다. */
  second: string;
}

export interface AuthState {
  user: AuthUser | null;
  /** 체인 #5. 참이면 비밀번호 변경 외의 화면으로 가면 안 된다(backend/security.md). */
  mustChangePassword: boolean;
  /** 권한 있는 <b>리프 코드</b>. 버튼·진입 판정이 묻는 값이며 트리 순회가 아니다. */
  menus: string[];
  permissions: string[];
  /** 사이더가 그리는 트리. 조상은 서버가 역산해 넣었다(AUTHZ-04). */
  menuTree: MenuNode[];
  /**
   * 마지막으로 관찰한 `X-Authz-Version`.
   *
   * <p>이 값과 다른 헤더가 오면 권한이 바뀐 것이며 `/auth/me` 로 다시 받는다. <b>`null` 은
   * "아직 모른다"</b> 이고 "바뀌었다" 가 아니다 — 헤더 없는 응답을 변경으로 오해하면 로그인
   * 직후 헛 재조회가 돈다.
   */
  authzVersion: string | null;
  /** 만료까지의 예산(초) — 셸이 예고 타이머를 거는 근거다. 0 이면 세션이 없다. */
  expiresInSeconds: number;
  /**
   * 엑셀 <b>전체</b> 다운로드의 행 상한 — playbook/excel-download.md · sys/code.md.
   *
   * <p>`cacheVersions` 처럼 사용자별이 아니지만 <b>담는다</b> — 엑셀을 누른 순간 총 건수와
   * 비교해야 하고, 그때 물으면 클릭에 왕복이 하나 붙는다.
   */
  excelMaxRows: number;
  /**
   * 엑셀 <b>업로드</b>의 행 상한 — 내려받기와 <b>다른 값</b>이다(2026-09-02 실측).
   *
   * <p>내려받기는 브라우저가 만드는 파일의 크기이고 올리기는 파싱 + <b>서버의 한
   * 트랜잭션</b>이다. 파싱은 5만 행이 1.5초로 싸지만 저장은 2만이 12.5초다 — 같은 값으로
   * 두면 사용자를 30초 기다리게 하거나 멀쩡한 내려받기를 깎아야 한다(`UiExcelProps`).
   */
  excelMaxUploadRows: number;
  /**
   * 조회 기간의 <b>시스템 층</b> — sys/code.md · screen/log/access/requirements.md.
   *
   * <p>`excelMaxRows` 와 같은 성격이다. 화면은 이것을 <i>더 좁게</i> 덮으며(사용 이력이
   * 1 · 31), 프론트에 7 · 92 를 박아 두면 `SYS_CONFIG` 와 어긋난다 — 그 어긋남은
   * <b>폼이 통과시킨 조회를 서버가 400 으로 거부하는 것</b>으로만 드러난다.
   */
  searchRange: { defaultDays: number; maxDays: number };
  /**
   * 날짜 표시 형식 — sys/code.md · frontend/grid.md. <b>정밀도 셋이 각자 문자열을 갖는다.</b>
   *
   * <p>`excelMaxRows`·`searchRange` 와 같은 성격이다 — 사용자별이 아니지만 <b>화면이 값을
   * 그리는 데 필요한 기준</b>이며 몇 바이트다. 셀마다 물을 수 없고, 프론트에 박아 두면
   * `SYS_CONFIG` 와 어긋난다 — 그 어긋남은 <b>설정을 고쳤는데 화면이 그대로인 것</b>으로만
   * 드러난다.
   */
  dateFormat: DateFormat;
  /** 첫 복원(`/auth/me`)이 끝났는가. 끝나기 전에는 로그인 화면으로 보내면 안 된다. */
  restored: boolean;

  signIn: (session: AuthSession) => void;
  signOut: () => void;
  /**
   * 이름만 갈아 끼운다 — 내 정보 저장(frontend/tabs.md)이 헤더를 그 자리에서 바꾼다.
   *
   * <p>서버는 세션 주체도 함께 고치므로 새로고침해도 새 이름이다. 여기서 고치지 않으면
   * **저장은 됐는데 헤더만 옛 이름**이 되고, 그것은 저장이 실패한 것처럼 보인다.
   */
  renameUser: (userNm: string) => void;
  /**
   * 제한 세션을 푼다 — 체인 #5 는 차단이 아니라 유도이고(backend/security.md) 유도의 끝에는 문이
   * 열려야 한다. 서버가 세션 표시를 내리는 것과 짝이다.
   */
  clearPasswordChange: () => void;
  markRestored: () => void;
  observeAuthzVersion: (version: string) => void;
}

export interface AuthSession {
  user: AuthUser;
  mustChangePassword: boolean;
  menus: string[];
  permissions: string[];
  menuTree: MenuNode[];
  /**
   * 프론트 캐시의 유효성 기준 — `{ message: 3, … }`(sys/code.md).
   *
   * <p>**스토어에 담지 않는다.** 값이 아니라 *"들고 있는 캐시를 버릴까"* 의 판단 재료이며,
   * 그 판단은 받은 자리에서 끝난다(`messageStore.syncWithSession`). 담아 두면 캐시의
   * 실제 버전과 이 값이 어긋나는 순간이 생기고, 어느 쪽이 맞는지 알 방법이 없다.
   */
  cacheVersions: Record<string, number>;
  /**
   * 만료까지의 예산(초).
   *
   * <p><b>스토어에 담지 않는 `cacheVersions` 와 다르다.</b> 저것은 받은 자리에서 판단이
   * 끝나지만 이것은 <b>셸이 세션 내내 들고 타이머를 건다</b> — 담지 않으면 만료 예고를
   * 붙일 근거가 매 요청 사라진다.
   */
  expiresInSeconds: number;
  /** 엑셀 전체 다운로드의 행 상한 — 옛 서버는 안 보낼 수 있다. */
  excelMaxRows?: number;
  /** 엑셀 업로드의 행 상한 — 〃. 내려받기와 다른 값이다(`UiExcelProps`). */
  excelMaxUploadRows?: number;
  /** 조회 기간의 시스템 기본값(일) — 옛 서버는 안 보낼 수 있다. */
  searchRangeDefaultDays?: number;
  /** 조회 기간의 시스템 상한(일) — 〃. */
  searchRangeMaxDays?: number;
  /**
   * 날짜 표시 형식 셋 — 옛 서버는 안 보낼 수 있다.
   *
   * <p><b>칸마다 비어 있을 수 있다.</b> 설정 화면에서 값을 지우면 그 정밀도만 빈 문자열로
   * 오며, 그때는 ISO 기본으로 떨어진다(`shared/grid/dateFormat`).
   */
  dateFormat?: Partial<DateFormat>;
}

const EMPTY = {
  user: null,
  mustChangePassword: false,
  menus: [] as string[],
  permissions: [] as string[],
  menuTree: [] as MenuNode[],
  authzVersion: null as string | null,
  expiresInSeconds: 0,
  excelMaxRows: 0,
  /*
    <b>업로드는 0 이 곧 막힘이다.</b> 서버가 값을 안 보냈을 때 넉넉히 잡으면 화면이
    통과시킨 파일을 서버가 거절하고, 그 사고는 <b>412행을 읽은 뒤에</b> 드러난다.
  */
  excelMaxUploadRows: 0,
  /*
    <b>기본이 넉넉하지 않다.</b> 서버가 값을 안 보냈을 때 상한을 크게 잡으면 폼이 통과시킨
    조회를 서버가 400 으로 거부한다 — 문서의 값(7 · 92)을 그대로 둔다.
  */
  searchRange: { defaultDays: 7, maxDays: 92 },
  /*
    <b>ISO 다</b> — frontend/grid.md. 서버가 안 보냈을 때 조직의 관례를 여기 적으면, 설정을 비운
    배포가 그 관례를 물려받고 <b>설정 화면에 없는 값</b>으로 날짜가 그려진다.
  */
  dateFormat: { month: 'YYYY-MM', day: 'YYYY-MM-DD', second: 'YYYY-MM-DD HH:mm:ss' },
};

/**
 * 로그인 사용자와 권한 — frontend/packages.md.
 *
 * <p><b>{@code persist} 를 붙이지 않는 것이 결정이다.</b> 붙이면 로그아웃한 뒤에도 그 PC 에
 * 이전 사용자의 메뉴 구조가 남는다. F5 마다 왕복 하나를 그 대가로 감수한다.
 *
 * <p>비우는 것은 <b>로그아웃 정리뿐</b>이다 — 세션 만료로는 비우지 않는다. 재인증 모달이
 * 탭과 입력값을 그대로 두고 뜨려면 그때 사용자 정보가 살아 있어야 하기 때문이다
 * (backend/session.md).
 */
export const useAuthStore = create<AuthState>((set) => ({
  ...EMPTY,
  restored: false,

  signIn: (session) =>
    set({
      user: session.user,
      mustChangePassword: session.mustChangePassword,
      menus: session.menus,
      permissions: session.permissions,
      menuTree: session.menuTree ?? [],
      expiresInSeconds: session.expiresInSeconds ?? 0,
      excelMaxRows: session.excelMaxRows ?? 0,
      excelMaxUploadRows: session.excelMaxUploadRows ?? 0,
      searchRange: {
        defaultDays: session.searchRangeDefaultDays ?? EMPTY.searchRange.defaultDays,
        maxDays: session.searchRangeMaxDays ?? EMPTY.searchRange.maxDays,
      },
      // 칸마다 떨어진다 — 하나를 비운 설정이 나머지 둘을 ISO 로 되돌리지 않는다.
      dateFormat: {
        month: session.dateFormat?.month ?? EMPTY.dateFormat.month,
        day: session.dateFormat?.day ?? EMPTY.dateFormat.day,
        second: session.dateFormat?.second ?? EMPTY.dateFormat.second,
      },
      restored: true,
    }),

  signOut: () => set({ ...EMPTY, restored: true }),

  renameUser: (userNm) =>
    // 사용자가 없으면 아무 일도 하지 않는다 — 빈 상태에 이름만 있는 주체를 만들지 않는다.
    set((state) => (state.user ? { user: { ...state.user, userNm } } : {})),

  clearPasswordChange: () => set({ mustChangePassword: false }),

  markRestored: () => set({ restored: true }),

  // 헤더를 본 사실만 남긴다. 재조회를 거는 것은 셸이며, 여기서 부르면 스토어가 API 를
  // 알게 되고 테스트가 네트워크를 타게 된다.
  observeAuthzVersion: (authzVersion) => set({ authzVersion }),
}));
