import dayjs from 'dayjs';

/**
 * *"오늘 하루 보지 않기"* 의 저장 — 66 §2.4.
 *
 * <h2>서버가 아니라 기기다</h2>
 *
 * <p>main-shell.md §9.1 의 *"UI 설정은 기기의 속성"* 이며, 여기에는 근거가 하나 더 있다 —
 * **읽음을 두지 않기로 한 것과의 정합**(66 §2.2). *안 보기* 는 읽음의 약한 형태이고,
 * 읽음 없이 안 보기만 서버에 두면 **같은 사실을 반쪽만 저장**하게 된다.
 *
 * <p>기기를 바꾸면 다시 뜨는 것이 **팝업의 목적에 맞다** — 팝업은 취향이 아니라 도달
 * 보장 장치다.
 *
 * <h2>키가 공지마다 하나다</h2>
 *
 * <p>하나의 키에 목록을 담으면 **읽고 고쳐 쓰는 동안 다른 탭이 덮어쓴다** — 멀티탭
 * 셸이다(ADR-0005). 값은 만료 시각(epoch ms)이며 **다음 자정**이다.
 *
 * <p>영구 숨김은 두지 않는다. 공지는 *"중요해서 팝업으로 띄운 것"* 이므로 영구 숨김은
 * 그 판단을 사용자가 무르는 버튼이 된다 — 하루면 다음 날 다시 묻고, 게시 기간이 끝나면
 * 저절로 멈춘다(66 §2.3).
 */
const PREFIX = 'notice.dismissed.';

/** 다음 자정 — **브라우저의 자정**이다. 담기는 곳이 기기이므로 기준도 기기의 시계다. */
function nextMidnight(): number {
  return dayjs().endOf('day').valueOf();
}

/**
 * 이 공지를 오늘 감췄는가.
 *
 * <p><b>지나간 키는 이 자리에서 지운다</b>(66 §2.4) — 별도 청소 경로를 만들지 않는다.
 * 팝업이 뜰 때만 도는 코드라 그 시점이 유일하게 확실한 청소 시점이다.
 */
export function isDismissed(noticeId: number): boolean {
  purgeExpired();
  const raw = read(PREFIX + String(noticeId));
  if (raw === null) {
    return false;
  }
  return Number(raw) > Date.now();
}

/** 오늘 하루 감춘다. */
export function dismiss(noticeId: number): void {
  write(PREFIX + String(noticeId), String(nextMidnight()));
}

/** 만료된 것만 지운다 — 살아 있는 다른 공지의 키는 건드리지 않는다. */
function purgeExpired(): void {
  const store = storage();
  if (store === null) {
    return;
  }
  const now = Date.now();
  const stale: string[] = [];
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index);
    if (key !== null && key.startsWith(PREFIX) && Number(store.getItem(key)) <= now) {
      stale.push(key);
    }
  }
  stale.forEach((key) => store.removeItem(key));
}

function read(key: string): string | null {
  return storage()?.getItem(key) ?? null;
}

function write(key: string, value: string): void {
  storage()?.setItem(key, value);
}

/**
 * `localStorage` 를 못 쓰는 브라우저가 있다 — 시크릿 모드의 일부 설정, 저장 차단.
 *
 * <p>그때 **팝업은 매번 뜬다.** 그것이 맞는 실패 방향이다: 도달 보장 장치이므로
 * *"감춰졌을지도 모른다"* 보다 *"또 떴다"* 가 낫다.
 */
function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
