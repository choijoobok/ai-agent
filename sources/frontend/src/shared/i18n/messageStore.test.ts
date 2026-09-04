import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchMessageBundle } from '@/shared/i18n/api/messageApi';
import { useMessageStore } from '@/shared/i18n/messageStore';
import { label } from '@/shared/i18n/label';

vi.mock('@/shared/i18n/api/messageApi', () => ({ fetchMessageBundle: vi.fn() }));

const fetchBundle = vi.mocked(fetchMessageBundle);

/**
 * 번들 캐시 — · sys/code.md.
 *
 * <p>여기서 지키는 것은 셋이다. **두 번째 접속이 전량을 다시 받지 않는가**(버전 확인만),
 * **세션 복원이 확인조차 하지 않는가**, 그리고 **서버가 닿지 않아도 화면이 뜨는가**.
 *
 * <p>마지막 것이 특히 조용히 깨진다 — 캐시가 있으면 화면이 정상으로 보이므로, 폴백이
 * 동작하는지는 서버를 끄고 눌러 보지 않는 한 알 수 없다.
 */
describe('messageStore', () => {
  const CACHE_KEY = 'backoffice.message:ko';
  const LANGS = ['ko', 'en'];
  const CACHED = { version: 3, langs: ['ko', 'en'], messages: { 'login.title': '백오피스 로그인' } };

  beforeEach(() => {
    window.localStorage.clear();
    fetchBundle.mockReset();
    useMessageStore.setState({ lang: 'ko', langs: [], version: null, messages: {}, status: 'idle' });
  });

  it('첫 접속은 전량을 받고 캐시에 넣는다', async () => {
    fetchBundle.mockResolvedValue({ lang: 'ko', langs: LANGS, version: 3, unchanged: false, messages: CACHED.messages });

    await useMessageStore.getState().load({ lang: 'ko' });

    expect(useMessageStore.getState().version).toBe(3);
    expect(label('login.title')).toBe('백오피스 로그인');
    expect(JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? 'null')).toEqual(CACHED);
  });

  it('두 번째 접속은 들고 있는 버전을 보내고 본문 없이 끝난다', async () => {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(CACHED));
    fetchBundle.mockResolvedValue({ lang: 'ko', langs: LANGS, version: 3, unchanged: true });

    await useMessageStore.getState().load({ lang: 'ko' });

    expect(fetchBundle).toHaveBeenCalledWith('ko', 3);
    // 본문이 없었는데도 문구가 있어야 한다 — 캐시를 그대로 쓴 것이다.
    expect(label('login.title')).toBe('백오피스 로그인');
  });

  it('세션 복원 경로는 버전을 확인하지 않는다 — ', async () => {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(CACHED));

    await useMessageStore.getState().load({ lang: 'ko', verify: false });

    expect(fetchBundle).not.toHaveBeenCalled();
    expect(label('login.title')).toBe('백오피스 로그인');
  });

  it('세션이 있어도 캐시가 없으면 받는다 — 다른 PC 의 첫 로그인', async () => {
    fetchBundle.mockResolvedValue({ lang: 'ko', langs: LANGS, version: 3, unchanged: false, messages: CACHED.messages });

    await useMessageStore.getState().load({ lang: 'ko', verify: false });

    expect(fetchBundle).toHaveBeenCalledOnce();
  });

  it('서버가 다른 언어를 골랐는데 unchanged 면 다시 받는다 — 남의 언어 캐시를 쓰지 않는다', async () => {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(CACHED));
    fetchBundle
      .mockResolvedValueOnce({ lang: 'en', langs: LANGS, version: 3, unchanged: true })
      .mockResolvedValueOnce({
        lang: 'en',
        langs: LANGS,
        version: 3,
        unchanged: false,
        messages: { 'login.title': 'Backoffice Sign-in' },
      });

    await useMessageStore.getState().load({ lang: 'ko' });

    expect(fetchBundle).toHaveBeenCalledTimes(2);
    expect(useMessageStore.getState().lang).toBe('en');
    expect(label('login.title')).toBe('Backoffice Sign-in');
  });

  it('받지 못해도 캐시가 있으면 화면이 뜬다 — 낡은 문구가 흰 화면보다 낫다', async () => {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(CACHED));
    fetchBundle.mockRejectedValue(new Error('offline'));

    await useMessageStore.getState().load({ lang: 'ko' });

    expect(useMessageStore.getState().status).toBe('ready');
    expect(label('login.title')).toBe('백오피스 로그인');
  });

  it('캐시도 없고 받지도 못하면 실패로 표시한다 — 키 문자열 화면을 내지 않는다', async () => {
    fetchBundle.mockRejectedValue(new Error('offline'));

    await useMessageStore.getState().load({ lang: 'ko' });

    expect(useMessageStore.getState().status).toBe('failed');
  });

  it('JSON 이 아닌 캐시는 없는 것으로 친다', async () => {
    window.localStorage.setItem(CACHE_KEY, '{ 이건 JSON 이 아니다');
    fetchBundle.mockResolvedValue({ lang: 'ko', langs: LANGS, version: 3, unchanged: false, messages: CACHED.messages });

    await useMessageStore.getState().load({ lang: 'ko' });

    // v 를 보내지 않았다는 것이 "캐시가 없다고 판단했다" 는 뜻이다.
    expect(fetchBundle).toHaveBeenCalledWith('ko', undefined);
    expect(useMessageStore.getState().status).toBe('ready');
  });

  // 위 검사만 두면 모양 검사를 통째로 지워도 통과한다 — JSON.parse 가 먼저 던지기 때문이다.
  // 실제로 위험한 것은 **파싱되는데 모양이 다른** 값이며, 옛 캐시 형식이 정확히 그것이다.
  it.each([
    ['버전이 문자열이다', '{"version":"3","messages":{}}'],
    ['messages 가 없다', '{"version":3}'],
    ['null 이다', 'null'],
    ['배열이다', '[]'],
  ])('모양이 다른 캐시도 없는 것으로 친다 — %s', async (_name, raw) => {
    window.localStorage.setItem(CACHE_KEY, raw);
    fetchBundle.mockResolvedValue({ lang: 'ko', langs: LANGS, version: 3, unchanged: false, messages: CACHED.messages });

    await useMessageStore.getState().load({ lang: 'ko' });

    expect(fetchBundle).toHaveBeenCalledWith('ko', undefined);
    expect(label('login.title')).toBe('백오피스 로그인');
  });

  describe('로그인 응답과 맞추기', () => {
    it('언어도 버전도 같으면 아무 일도 하지 않는다 — 로그인마다 전량을 다시 받지 않는다', async () => {
      useMessageStore.setState({
        lang: 'ko',
        langs: LANGS,
        version: 3,
        messages: CACHED.messages,
        status: 'ready',
      });

      await useMessageStore.getState().syncWithSession('ko', 3);

      expect(fetchBundle).not.toHaveBeenCalled();
    });

    it('버전이 다르면 다시 받는다 — 관리자가 문구를 고쳤다', async () => {
      useMessageStore.setState({
        lang: 'ko',
        langs: LANGS,
        version: 3,
        messages: CACHED.messages,
        status: 'ready',
      });
      fetchBundle.mockResolvedValue({ lang: 'ko', langs: LANGS, version: 4, unchanged: false, messages: {} });

      await useMessageStore.getState().syncWithSession('ko', 4);

      expect(fetchBundle).toHaveBeenCalledOnce();
      expect(useMessageStore.getState().version).toBe(4);
    });

    it('LOCALE_CD 가 캐시와 다르면 그 언어로 갈아 끼운다 — 다른 PC 의 첫 로그인', async () => {
      useMessageStore.setState({
        lang: 'ko',
        langs: LANGS,
        version: 3,
        messages: CACHED.messages,
        status: 'ready',
      });
      fetchBundle.mockResolvedValue({
        lang: 'en',
        langs: LANGS,
        version: 3,
        unchanged: false,
        messages: { 'login.title': 'Backoffice Sign-in' },
      });

      await useMessageStore.getState().syncWithSession('en', 3);

      expect(useMessageStore.getState().lang).toBe('en');
      expect(label('login.title')).toBe('Backoffice Sign-in');
    });
  });
});
