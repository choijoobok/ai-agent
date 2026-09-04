/**
 * 요청마다 새 UUID 를 만든다 — 중복 요청 방어와 추적 ID 를 겸한다(backend/crosscutting.md · frontend/packages.md).
 *
 * <p><b>폴백이 필수다.</b> `crypto.randomUUID` 는 secure context 전용이라
 * 사내망 평문 HTTP(`http://10.x.x.x`)에서는 존재하지 않는다. 없는 채로 부르면
 * 요청 자체가 죽는다.
 */
export function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    // getRandomValues 조차 없는 환경. 추적·중복 판정용이므로 암호학적 강도는 요구가 아니다.
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
