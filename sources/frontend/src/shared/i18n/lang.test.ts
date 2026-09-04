import { beforeEach, describe, expect, it } from 'vitest';
import { normalizeLang, rememberLang, resolveLang } from '@/shared/i18n/lang';

/**
 * 언어 결정 — 50 §3.2.
 *
 * <p>여기서 지키는 것은 **어떤 입력이든 지원 언어 하나로 닫힌다**는 것이다. 닫히지 않는
 * 입력이 하나라도 있으면 *"서버 기본 언어"* 라는 3순위가 필요해지고, 그 순간
 * *"서버 기본이 ko 인데 브라우저가 ja 면?"* 이 되살아난다.
 *
 * <p>같은 표를 서버의 `RequestLocaleTest` 도 지킨다 — 프론트는 첫 요청을 보내기 전에
 * 언어를 정해야 해서 피할 수 없는 중복이며, 그래서 **양쪽이 같은 답을 내는지**가 중요하다.
 */
describe('lang', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('지역을 버리고 언어만 본다', () => {
    expect(normalizeLang('ko-KR')).toBe('ko');
    expect(normalizeLang('ko_KR')).toBe('ko');
    expect(normalizeLang('en-US')).toBe('en');
  });

  it('대소문자를 가리지 않는다', () => {
    expect(normalizeLang('KO')).toBe('ko');
    expect(normalizeLang('EN-us')).toBe('en');
  });

  it('모르는 언어는 en 이다 — 번역 폴백 언어(ko)와 다른 축이다', () => {
    // 일본어 브라우저에 한국어를 주는 것은 답이 아니다.
    expect(normalizeLang('ja')).toBe('en');
    expect(normalizeLang('zh-CN')).toBe('en');
  });

  it('비었거나 없으면 en 이다 — 던지지 않는다', () => {
    expect(normalizeLang(null)).toBe('en');
    expect(normalizeLang(undefined)).toBe('en');
    expect(normalizeLang('')).toBe('en');
  });

  it('직전 언어가 브라우저 언어를 이긴다 — 순위 1', () => {
    rememberLang('ko');

    expect(resolveLang()).toBe('ko');
  });

  it('저장된 것이 없으면 브라우저 언어다 — 순위 2', () => {
    expect(resolveLang()).toBe(normalizeLang(navigator.language));
  });

  it('localStorage 가 던져도 앱이 죽지 않는다 — 사생활 보호 모드', () => {
    const broken = () => {
      throw new Error('denied');
    };
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: broken,
    });

    try {
      // 번들을 받기 전에 부르는 함수라 여기서 던지면 흰 화면이 된다.
      expect(() => resolveLang()).not.toThrow();
      expect(() => rememberLang('ko')).not.toThrow();
    } finally {
      if (original) Object.defineProperty(window, 'localStorage', original);
    }
  });
});
