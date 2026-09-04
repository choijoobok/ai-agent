import { label } from '@/shared/i18n/label';

/**
 * 공통코드 값을 사람이 읽는 이름으로 — 43 §4.4.
 *
 * <p><b>데이터에서 조립된 키다</b>(`code.{GRP_CD}.{DTL_CD}`). 그래서 `messageKeys.ts` 에
 * 상수가 없고 `generateMessageSeed` 도 건드리지 않는다 — `menu.{MENU_CD}` 와 같은 부류이며,
 * 008 이 *"menu.* · code.* 접두는 여기 없다"* 로 적어 둔 그것이다. `label()` 에 리터럴을
 * 넘기지 못하게 하는 ESLint 규칙도 같은 이유로 여기를 지나지 않는다: **키가 리터럴이 아니다.**
 *
 * <p><b>코드에 이름을 적어 두지 않는다.</b> `{ ko: '한국어' }` 같은 표를 두면 값을 하나 더할
 * 때마다 프론트를 고쳐야 하고, 그 이름이 <b>번역되지 않는다</b> — 명칭의 단일 원본은 언제나
 * `SYS_MESSAGE` 다(43 §3).
 *
 * <p>행이 없으면 키가 그대로 보인다(`code.LANG_CD.ko`). 빈 칸이나 코드값으로 떨어뜨리지
 * 않는 것이 규약이며, 등록을 빠뜨렸다는 사실이 화면에서 즉시 드러나야 한다(43 §4.4 · §7.3).
 *
 * <p><b>`lang.ts` 가 아니라 여기 있다.</b> 그쪽에 두면 `lang → label → messageStore → lang`
 * 순환이 생기고, `messageStore` 는 초기 상태를 만들며 `resolveLang()` 을 부른다 — 순환 안에서
 * 아직 평가되지 않은 함수를 부르는 것이라 <b>기동이 흰 화면으로 죽는다</b>.
 */
export function codeLabel(grpCd: string, dtlCd: string): string {
  return label(`code.${grpCd}.${dtlCd}`);
}

/**
 * 언어 그룹. <b>`SYS_CODE` 는 있지만 `LANG_CD` 그룹 행이 아직 없다</b>(시드된 그룹은
 * `LOGIN_RSLT_CD` · `CODE_REF_KEY` 둘뿐이다).
 *
 * <p><b>그래서 지금 둘의 출처가 갈린다</b> — <b>후보 목록</b>은 서버 설정
 * `sys-config.message.supported`(`MessageProps` → 번들의 `langs`)이 주고, <b>이름</b>만
 * `code.LANG_CD.{값}` 메시지가 준다. 그룹 행이 생기는 날 후보의 출처가 이쪽으로 넘어오며,
 * <b>키 규약을 먼저 맞춰 둔 덕에 그날 화면은 바뀌지 않는다.</b>
 */
export const LANG_CD = 'LANG_CD';
