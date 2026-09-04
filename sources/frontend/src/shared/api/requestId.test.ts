import { describe, expect, it, vi, afterEach } from 'vitest';
import { newRequestId } from '@/shared/api/requestId';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('newRequestId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('crypto.randomUUID 가 있으면 그것을 쓴다', () => {
    expect(newRequestId()).toMatch(UUID_V4);
  });

  it('randomUUID 가 없어도 v4 모양을 만든다 — secure context 아닌 사내망 평문 HTTP', () => {
    vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });

    expect(newRequestId()).toMatch(UUID_V4);
  });

  it('crypto 자체가 없어도 죽지 않는다', () => {
    vi.stubGlobal('crypto', undefined);

    expect(newRequestId()).toMatch(UUID_V4);
  });

  it('매번 다른 값이다 — 중복 요청 판정의 전제', () => {
    const ids = new Set(Array.from({ length: 500 }, () => newRequestId()));

    expect(ids.size).toBe(500);
  });
});
