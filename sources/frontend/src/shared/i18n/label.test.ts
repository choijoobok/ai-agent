import { beforeEach, describe, expect, it } from 'vitest';
import { label } from '@/shared/i18n/label';
import { useMessageStore } from '@/shared/i18n/messageStore';

/**
 * 문구 조립 — 43 §7.3.
 *
 * <p>여기서 지키는 것은 **누락이 조용하지 않은가**이다. 빈 문자열이나 "—" 를 내면 화면은
 * 멀쩡해 보이고 빠진 문구는 아무도 모른다 — 키가 그대로 보여야 즉시 신고된다.
 */
describe('label', () => {
  beforeEach(() => {
    useMessageStore.setState({
      lang: 'ko',
      version: 1,
      status: 'ready',
      messages: {
        'shell.logout': '로그아웃',
        'tab.limit.title': '탭이 최대 {limit}개입니다',
        'screen.missing.desc': 'MENU_CD={menuCd} · MENU_URL={menuUrl} 에 대응하는 화면이 없습니다.',
        'dashboard.greeting': '{name}님, 안녕하세요.',
      },
    });
  });

  it('키에 해당하는 문구를 낸다', () => {
    expect(label('shell.logout')).toBe('로그아웃');
  });

  it('없으면 키를 그대로 낸다 — 누락이 화면에서 드러나야 한다', () => {
    expect(label('shell.nothing')).toBe('shell.nothing');
  });

  it('자리표를 채운다', () => {
    expect(label('tab.limit.title', { limit: 20 })).toBe('탭이 최대 20개입니다');
  });

  it('자리표가 여럿이어도 각각 채운다', () => {
    expect(label('screen.missing.desc', { menuCd: 'ORDER', menuUrl: '/order' })).toBe(
      'MENU_CD=ORDER · MENU_URL=/order 에 대응하는 화면이 없습니다.',
    );
  });

  it('빈 문자열도 값이다 — 사용자 이름이 없다고 자리표가 남지 않는다', () => {
    expect(label('dashboard.greeting', { name: '' })).toBe('님, 안녕하세요.');
  });

  it('번역이 자리표를 빠뜨렸으면 원문이 그대로 남는다 — 빈 칸이 아니다', () => {
    // 채울 값을 주지 않았다. 지워 버리면 무엇이 잘못됐는지 화면에서 알 수 없다.
    expect(label('tab.limit.title')).toBe('탭이 최대 {limit}개입니다');
    expect(label('tab.limit.title', { other: 1 })).toBe('탭이 최대 {limit}개입니다');
  });

  it('키에도 자리표 치환이 돈다 — 문구가 없을 때도 무엇이 빠졌는지 보인다', () => {
    expect(label('missing.{name}', { name: 'x' })).toBe('missing.x');
  });
});
