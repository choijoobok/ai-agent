import type { ColumnDef } from '@/shared/grid/types';

/**
 * 파일의 <b>글자</b> → 컬럼의 <b>값</b> — `workbook.cellValue` 의 반대편이다(ADR-0024).
 *
 * <p><b>양식이 곧 다운로드다</b>(grid-standard.md §2.2 · 68 §8.2) — ②의 *전체* 가 만든 파일을 사람이
 * 고쳐서 올린다. 그래서 여기서 읽어야 하는 것은 <b>그쪽이 쓴 것</b>이며, 두 규칙이
 * 갈리면 <i>내려받아 그대로 올렸는데 전부 오류</i> 가 된다.
 *
 * <h2>코드는 값과 이름을 둘 다 받는다 — 68 §11.1</h2>
 *
 * <p>사람은 <b>화면에 보이는 이름</b>을 붙여넣고 타 시스템은 코드를 준다. 한쪽만 받으면
 * 양식이 <b>그 절반에게 쓸 수 없다</b>.
 *
 * <p><b>이름이 두 코드에 걸리면 그 행이 오류다.</b> 역매핑이 유일하지 않을 수 있다는
 * 우려를 <b>거절로 갚는다</b> — 둘 중 하나를 조용히 고르는 것이 그 미결이 걱정하던
 * 바로 그 사고이며, 그렇게 저장된 행은 <b>화면에서 정상으로 보인다</b>.
 *
 * <h2>못 읽으면 값이 아니라 사유를 돌려준다</h2>
 *
 * <p>{@code null} 로 떨어뜨리면 <i>비운 칸</i>과 <b>못 읽은 칸</b>이 같아진다. 앞은
 * 사용자의 뜻이고 뒤는 사고이며, 뒤를 앞으로 저장하면 <b>값이 조용히 지워진다</b>.
 */
export type ParseResult = { ok: true; value: unknown } | { ok: false; message: string };

/** 못 읽은 사유는 <b>완성된 문구</b>로 온다 — 화면이 그대로 셀에 붙인다(grid-edit-validation.md §3.3). */
export interface ParseText {
  /** `{value}` 가 파일에 있던 글자다. */
  notNumber: (value: string) => string;
  notInteger: (value: string) => string;
  notYn: (value: string) => string;
  unknownCode: (value: string) => string;
  ambiguousCode: (value: string) => string;
}

export function parseCell<T>(column: ColumnDef<T>, raw: unknown, text: ParseText): ParseResult {
  const value = normalize(raw);
  // 빈 칸은 <b>비운 것</b>이다 — 필수 여부는 검증이 본다(grid-edit-validation.md §3.2), 여기가 아니다.
  if (value === null) return { ok: true, value: null };

  if (column.type === 'ynFlag') {
    const upper = value.toUpperCase();
    if (upper === 'Y') return { ok: true, value: true };
    if (upper === 'N') return { ok: true, value: false };
    return { ok: false, message: text.notYn(value) };
  }

  /*
    <b>후보가 있으면 값이거나 이름이다</b> — `code` 든 `select` 든 같다. 후보가 아직 안
    온 컬럼({@code grpCd} 인데 공통코드가 도착 전)은 여기 걸리지 않고 아래 글자로 떨어지는데,
    그것은 <b>고장이 아니라 순서</b>다 — 부르는 쪽이 후보를 받은 뒤에 읽는다.
  */
  if (column.options && column.options.length > 0) {
    const byValue = column.options.find((option) => option.value === value);
    if (byValue) return { ok: true, value: byValue.value };

    const byText = column.options.filter((option) => option.text === value);
    if (byText.length === 1) return { ok: true, value: byText[0].value };
    if (byText.length > 1) return { ok: false, message: text.ambiguousCode(value) };
    return { ok: false, message: text.unknownCode(value) };
  }

  if (column.type === 'number') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return { ok: false, message: text.notNumber(value) };
    return { ok: true, value: numeric };
  }

  /*
    <b>큰 정수는 문자열로 남는다</b>(68 §9.10). {@code Number()} 로 확인만 해도 안 된다 —
    2^53 을 넘는 값은 그 순간 정밀도를 잃고, 우리는 <i>확인했으니 맞다</i> 고 믿는다.
    자릿수만 본다.
  */
  if (column.type === 'bigint') {
    if (!/^-?\d+$/.test(value)) return { ok: false, message: text.notInteger(value) };
    return { ok: true, value };
  }

  return { ok: true, value };
}

/**
 * 셀에서 온 것 → 다룰 수 있는 글자.
 *
 * <p><b>{@code Date} 가 올 수 있다.</b> 우리가 쓴 파일에는 날짜가 <i>글자</i>로 들어 있지만
 * (다운로드가 원본 문자열을 그대로 쓴다) <b>사람이 엑셀에서 날짜 칸에 입력하면</b> 진짜
 * 날짜 셀이 되고, 그때 {@code exceljs} 는 {@code Date} 를 준다 — 그것을 {@code String()}
 * 으로 밀면 <b>{@code Tue Sep 01 2026 …}</b> 이 값이 된다.
 *
 * <p><b>날짜는 로컬이 아니라 UTC 로 읽는다.</b> {@code exceljs} 는 시각 없는 날짜 셀을
 * 자정 UTC 로 만들므로, {@code getFullYear()} 계열로 꺼내면 <b>서쪽 시간대에서 하루가
 * 밀린다</b>.
 */
function normalize(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
  if (typeof raw !== 'string') {
    /*
      수식·하이퍼링크 셀은 객체로 온다({@code { result }} · {@code { text }}). 그 안의
      <b>보이는 값</b>을 꺼낸다 — 사람이 화면에서 본 것이 그것이고, 객체를 통째로 버리면
      <i>값이 있는데 빈 칸으로 읽혔다</i> 가 된다.
    */
    const object = raw as { result?: unknown; text?: unknown };
    if (object.result !== undefined) return normalize(object.result);
    if (object.text !== undefined) return normalize(object.text);
    return null;
  }
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}
