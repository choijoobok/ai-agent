import { useMessageStore } from '@/shared/i18n/messageStore';

/**
 * 메시지 키를 화면 문구로 — sys/code.md.
 *
 * <p><b>없으면 키를 그대로 낸다.</b> 빈 문자열이나 "—" 를 보여주면 누락이 숨는다 — 화면에
 * `login.title` 이 보이면 즉시 신고된다(원칙 P1). 서버도 같은 규칙이지만 마지막 수단은 각자
 * 정한다(`MessageService.find`) — 에러 응답의 마지막 수단은 키가 아니라 폴백 문구다.
 *
 * <p><b>훅이 아니라 함수다.</b> 모달 콜백·토스트·스토어 안에서도 불러야 하기 때문이며,
 * 그래서 컴포넌트는 언어가 바뀌어도 다시 그리지 않는다. 언어 교체는 <b>페이지를 다시
 * 부른다</b>(`SettingsModal` 의 `window.location.reload()`) — `key` 로 다시 마운트한다고
 * 적혀 있었으나 그런 코드는 없다(2026-08-31 확인).
 *
 * <p><b>그래서 이 함수의 결과를 `useMemo` 로 붙들어도 낡지 않는다</b> — 셸이 그것에 기대고
 * 있다(`ShellSider`). 언어를 다시 그려서 바꾸는 날에는 그 자리들이 함께 바뀌어야 한다.
 *
 * @param params `{name}` 자리를 채운다. 서버는 아직 치환이 필요한 키가 없어 프론트에만 있다
 */
export function label(messageKey: string, params?: Record<string, string | number>): string {
  const raw = useMessageStore.getState().messages[messageKey] ?? messageKey;
  return params ? format(raw, params) : raw;
}

/**
 * `{name}` 만 채운다. 자리표가 없으면 그대로 두는 것이 중요하다 — 번역이 자리표를 빠뜨렸을
 * 때 빈 칸이 아니라 **원문이 그대로** 보여야 무엇이 잘못됐는지 드러난다.
 */
function format(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}
