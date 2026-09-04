/** 서버 `ApiCatalogRow` · `ApiMenuRow` 와 1:1 — screen/menu/requirements.md. */

import type { Action } from '@/shared/authz/permission';

export interface ApiCatalogRow {
  /** PK. **기본 정렬이며 tie-breaker 가 필요 없다**(screen/menu/requirements.md). */
  apiUrl: string;
  /**
   * `@Operation.summary` 에서 온다 — **원본이 코드다**(backend/api.md).
   *
   * <p>**빌 수 없다.** ArchUnit 이 `summary` 없는 `/api/service/**` 핸들러에서 빌드를
   * 깨므로(screen/menu/requirements.md) *이름 없는 행* 을 화면이 어떻게 보일지 정할 필요가 없다 — 검증을
   * 사람에서 장치로 옮긴다는 원칙 P1 이 이 화면의 빈 칸 하나를 없앴다.
   */
  apiNm: string;
  /**
   * 액션 — **공통코드가 아니다**(sys/code.md). **API 의 속성**이며 값에 따라 프로세스가
   * 갈리므로 소스가 값을 갖는다(sys/menu.md).
   *
   * <p>집합이 `Action` 넷에서 닫히는 것이 backend/security.md 이고, 프론트가 그 넷을 이미 알고 있다
   * (`shared/authz/permission`) — 여기서 문자열 유니온을 새로 적으면 같은 사실이 두 곳이 된다.
   */
  actionCd: Action;
  /** `@Operation.description` — **빌 수 있다**. 선택이므로 컨트롤러가 안 적을 수 있다. */
  apiDesc: string | null;
  /**
   * 이 API 를 쓰는 메뉴 수 — **`0` 이면 미매핑**이다(screen/menu/requirements.md).
   *
   * <p>뜻은 *프론트가 부르지 않는 API 가 컨트롤러에 남아 있다* 이며, **대개 결함이지만
   * 언제나는 아니다** — 배포 예정 화면의 API 가 먼저 들어온 정상 경로가 있어 막지 않는다.
   */
  menuCount: number;
  /**
   * **최종 시드 반영** — *등록일* 이 아니다(screen/menu/requirements.md).
   *
   * <p>시드는 전건 삭제 후 전건 삽입이라(seed.md) **전 행이 같은 값**이다. 이 행들의
   * 감사는 시드 커밋의 git 이력이 한다(sys/menu.md) — 그래서 `regId` · `modId` 가 없고,
   * `modDtm` 도 없다(`UPDATE` 가 없으므로 언제나 비어 영영 빈 칸이 된다).
   */
  regDtm: string | null;
}

export interface ApiMenuRow {
  menuCd: string;
  /**
   * `시스템 › 이력 · 로그 › 에러 로그` — **전체 경로**다(screen/menu/requirements.md).
   *
   * <p>메뉴명만으로는 어느 것인지 모른다. 이 화면에 오는 사람은 403 하나를 들고 왔을 뿐이라
   * 그 메뉴를 **모르는 상태**다.
   */
  menuPath: string;
  /** 메뉴가 꺼져 있으면 이 매핑은 **살아 있어도 소용없다**(backend/security.md 게이트 ④). */
  useYn: boolean;
  /**
   * 이 메뉴에 닿는 사람 수 — AUTHZ-13.
   *
   * <p>**게이트 ④를 먹이지 않은 수**다. `useYn` 이 나란히 서서 *대상이 살아 있나* 를 말하고
   * 이 칸은 *줄 사람이 있나* 를 말한다 — 둘을 합치면 꺼진 메뉴의 인원이 전부 `0` 이 되어
   * 관리자가 무엇을 고쳐야 할지 알 수 없다(backend/security.md 가 ②와 ④를 가른 것과 같은 이유).
   */
  accessibleUserCount: number;
}
