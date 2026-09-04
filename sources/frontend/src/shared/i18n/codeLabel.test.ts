import { beforeEach, describe, expect, it } from 'vitest';
import { codeLabel, LANG_CD } from '@/shared/i18n/codeLabel';
import { useMessageStore } from '@/shared/i18n/messageStore';

/**
 * 공통코드 이름 — 43 §4.4.
 *
 * <p><b>화면이 코드값을 그리고 있었다</b>(2026-08-29 실물에서 잡음) — 설정 모달의 언어
 * 콤보와 프로필의 내 정보 둘 다 `ko` · `en` 이었다. 조용한 종류다: 값이 <b>있고</b> 화면도
 * 정상으로 보이며, 코드를 읽는 사람에게는 그것이 언어 코드라는 것이 자명하다.
 *
 * <p>재는 것 둘이다 — <b>키 규약</b>과 <b>누락의 신호</b>.
 */
describe('공통코드 이름', () => {
  beforeEach(() => {
    useMessageStore.setState({ messages: {} });
  });

  it('키가 code.{GRP_CD}.{DTL_CD} 다 — 그 규약으로 시드와 관리 화면이 만난다', () => {
    useMessageStore.setState({ messages: { 'code.LANG_CD.ko': '한국어' } });

    expect(codeLabel(LANG_CD, 'ko')).toBe('한국어');
  });

  it('행이 없으면 키가 그대로 보인다 — 코드값으로 떨어뜨리지 않는다', () => {
    // 빈 칸이나 `en` 으로 그리면 등록을 빠뜨렸다는 사실이 숨는다. 화면에
    // `code.LANG_CD.en` 이 보이면 즉시 신고된다(43 §4.4 · §7.3).
    expect(codeLabel(LANG_CD, 'en')).toBe('code.LANG_CD.en');
  });

  it('모르는 그룹도 같은 규칙이다 — 언어 전용 함수가 아니다', () => {
    useMessageStore.setState({ messages: { 'code.ACTION_CD.READ': '조회' } });

    expect(codeLabel('ACTION_CD', 'READ')).toBe('조회');
  });
});
