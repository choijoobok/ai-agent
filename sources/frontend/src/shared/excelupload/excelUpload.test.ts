import { describe, expect, it } from 'vitest';
import { parseCell, type ParseText } from '@/shared/excelupload/parseCell';
import { matchRows } from '@/shared/excelupload/matchRows';
import type { ColumnDef } from '@/shared/grid/types';

interface Item {
  ordNo: string | null;
  itemCd: string | null;
  qty: number | null;
  statCd: string | null;
  useYn: boolean | null;
}

/** 사유는 <b>완성된 문구</b>로 온다 — 검사에서는 갈래만 보면 된다. */
const text: ParseText = {
  notNumber: (value) => `notNumber:${value}`,
  notInteger: (value) => `notInteger:${value}`,
  notYn: (value) => `notYn:${value}`,
  unknownCode: (value) => `unknownCode:${value}`,
  ambiguousCode: (value) => `ambiguousCode:${value}`,
};

/**
 * 파일의 글자 → 컬럼의 값 — playbook/excel-upload.md · playbook/INDEX.md.
 *
 * <p><b>양식이 곧 ②의 전체 다운로드다</b>(frontend/grid.md). 그러므로 여기서 읽어야 하는 것은
 * <b>내려받기가 쓴 것</b>이며, 두 규칙이 갈리는 순간 <i>내려받아 그대로 올렸는데 전부
 * 오류</i> 가 된다 — 사용자에게 이 화면은 그 자리에서 쓸모를 잃는다.
 */
describe('엑셀 셀 읽기', () => {
  const code: ColumnDef<Item> = {
    field: 'statCd',
    header: 'h',
    type: 'code',
    options: [
      { value: 'RCV', text: '접수' },
      { value: 'CFM', text: '확정' },
    ],
  };

  describe('코드는 값과 이름을 둘 다 받는다 — playbook/INDEX.md', () => {
    it('코드값이 오면 그대로다 — 타 시스템이 주는 모양이다', () => {
      expect(parseCell(code, 'RCV', text)).toEqual({ ok: true, value: 'RCV' });
    });

    /*
      <b>사람은 화면에 보이는 이름을 붙여넣는다.</b> 내려받은 파일에 들어 있는 것도
      이름이므로(`workbook.cellValue`), 이쪽을 안 받으면 <b>양식이 자기 출력물을 못
      읽는다</b>.
    */
    it('코드명이 오면 값으로 바꾼다 — 내려받은 파일에 들어 있는 것이 이것이다', () => {
      expect(parseCell(code, '확정', text)).toEqual({ ok: true, value: 'CFM' });
    });

    /*
      <b>거절로 갚는다</b>(playbook/INDEX.md). 둘 중 하나를 조용히 고르면 그 행은 화면에서
      <b>정상으로 보이고</b>, 틀린 것은 아무도 모른다.
    */
    it('이름이 두 코드에 걸리면 그 행이 오류다', () => {
      const ambiguous: ColumnDef<Item> = {
        ...code,
        options: [
          { value: 'A', text: '보류' },
          { value: 'B', text: '보류' },
        ],
      };

      expect(parseCell(ambiguous, '보류', text)).toEqual({
        ok: false,
        message: 'ambiguousCode:보류',
      });
    });

    it('목록에 없으면 오류다 — 값도 이름도 아니다', () => {
      expect(parseCell(code, 'XXX', text)).toEqual({ ok: false, message: 'unknownCode:XXX' });
    });
  });

  /*
    <b>못 읽은 칸을 {@code null} 로 떨어뜨리지 않는다.</b> 그러면 <i>비운 칸</i>과
    구별되지 않고, 사고가 사용자의 뜻으로 저장된다 — 값이 조용히 지워진다.
  */
  it('숫자가 아니면 값이 아니라 사유다', () => {
    const qty: ColumnDef<Item> = { field: 'qty', header: 'h', type: 'number' };

    expect(parseCell(qty, '세 개', text)).toEqual({ ok: false, message: 'notNumber:세 개' });
  });

  /*
    <b>{@code Number()} 로 확인만 해도 안 된다</b>(playbook/INDEX.md) — 2^53 을 넘는 값은 그
    순간 정밀도를 잃고, 우리는 <i>확인했으니 맞다</i> 고 믿는다.
  */
  it('bigint 은 자릿수만 본다 — 큰 값이 정밀도를 잃지 않는다', () => {
    const id: ColumnDef<Item> = { field: 'ordNo', header: 'h', type: 'bigint' };
    const huge = '9007199254740993';

    expect(parseCell(id, huge, text)).toEqual({ ok: true, value: huge });
    expect(parseCell(id, '12.5', text)).toEqual({ ok: false, message: 'notInteger:12.5' });
  });

  it('빈 칸은 비운 것이다 — 필수 여부는 검증이 본다', () => {
    const qty: ColumnDef<Item> = { field: 'qty', header: 'h', type: 'number' };

    expect(parseCell(qty, '   ', text)).toEqual({ ok: true, value: null });
    expect(parseCell(qty, null, text)).toEqual({ ok: true, value: null });
  });

  it('ynFlag 는 Y/N 이고 나머지는 오류다', () => {
    const flag: ColumnDef<Item> = { field: 'useYn', header: 'h', type: 'ynFlag' };

    expect(parseCell(flag, 'Y', text)).toEqual({ ok: true, value: true });
    expect(parseCell(flag, 'n', text)).toEqual({ ok: true, value: false });
    expect(parseCell(flag, '예', text)).toEqual({ ok: false, message: 'notYn:예' });
  });

  /*
    <b>사람이 엑셀에서 날짜 칸에 입력하면 진짜 날짜 셀</b>이 되고 {@code exceljs} 는
    {@code Date} 를 준다 — {@code String()} 으로 밀면 `Tue Sep 01 2026 …` 이 값이 된다.
  */
  it('날짜 셀이 오면 날짜 글자로 읽는다 — 요일이 붙은 문자열이 되지 않는다', () => {
    const day: ColumnDef<Item> = { field: 'ordNo', header: 'h', type: 'date' };

    expect(parseCell(day, new Date('2026-09-01T00:00:00Z'), text))
      .toEqual({ ok: true, value: '2026-09-01' });
  });
});

/**
 * 읽은 행 ↔ 기존 행 대조 — playbook/excel-upload.md · playbook/INDEX.md.
 *
 * <p><b>변경 행만 나간다.</b> 412행짜리 파일에서 세 줄만 고쳐 올렸는데 전량이 나가면
 * 감사 컬럼이 전부 갱신되어 <b>누가 언제 무엇을 고쳤나</b> 를 잃는다 — 그 손실은
 * 되돌릴 수 없고, 그 뒤로 그 테이블의 감사 컬럼은 아무 말도 하지 않는다.
 */
describe('엑셀 행 대조', () => {
  const keys = ['ordNo', 'itemCd'];
  const row = (data: Partial<Item>): Item => ({
    ordNo: null, itemCd: null, qty: null, statCd: null, useYn: null, ...data,
  });

  it('DB 에 없으면 신규다', () => {
    const { rows } = matchRows([row({ ordNo: 'A', itemCd: 'X' })], [], keys);

    expect(rows[0].state).toBe('C');
    expect(rows[0].original).toBeNull();
  });

  it('있고 값이 다르면 변경이고, 되돌리기의 기준은 DB 행이다', () => {
    const existing = row({ ordNo: 'A', itemCd: 'X', qty: 1 });

    const { rows } = matchRows([row({ ordNo: 'A', itemCd: 'X', qty: 5 })], [existing], keys);

    expect(rows[0].state).toBe('U');
    expect(rows[0].original).toBe(existing);
  });

  /*
    <b>이것이 이 함수의 존재 이유다.</b> 같은 값을 변경으로 잡으면 파일 전체가 나가고,
    위 클래스 주석의 손실이 그대로 일어난다.
  */
  it('있고 값이 같으면 상태가 없다 — 고치지 않은 409행은 나가지 않는다', () => {
    const existing = row({ ordNo: 'A', itemCd: 'X', qty: 1 });

    const { rows } = matchRows([row({ ordNo: 'A', itemCd: 'X', qty: 1 })], [existing], keys);

    expect(rows[0].state).toBeNull();
  });

  /*
    기존 행에는 파일에 없는 컬럼이 있다(`ITEM_SEQ`·`ORD_ID`·감사 4 — playbook/INDEX.md). 통째로
    비교하면 <b>모든 행이 변경</b>이 되어 위 규칙이 무너진다.
  */
  it('파일에 없는 컬럼은 비교하지 않는다 — 서버가 채운 값이 모든 행을 변경으로 만들지 않는다', () => {
    const existing = { ...row({ ordNo: 'A', itemCd: 'X', qty: 1 }), itemSeq: 3, regId: 'admin' };

    const { rows } = matchRows([row({ ordNo: 'A', itemCd: 'X', qty: 1 })], [existing], keys);

    expect(rows[0].state).toBeNull();
  });

  it('키 조합이 겹치면 그 행들을 짚는다 — 어느 칸이라 말할 수 없다', () => {
    const { rows, duplicated } = matchRows(
      [row({ ordNo: 'A', itemCd: 'X' }), row({ ordNo: 'A', itemCd: 'X' })],
      [],
      keys,
    );

    expect(rows).toHaveLength(2);
    expect(duplicated).toEqual(['x2']);
  });

  /*
    <b>구분자가 값에 들어갈 수 없어야 한다.</b> 콤마나 하이픈이면 아래 둘이 같은 키가
    되어 <b>다른 두 행이 하나로 대조된다</b> — 한쪽의 값이 다른 쪽에 덮여 저장된다.
  */
  it('키 조각의 경계가 값에 먹히지 않는다 — A-B + C 와 A + B-C 는 다른 행이다', () => {
    const { duplicated } = matchRows(
      [row({ ordNo: 'A-B', itemCd: 'C' }), row({ ordNo: 'A', itemCd: 'B-C' })],
      [],
      keys,
    );

    expect(duplicated).toEqual([]);
  });

  it('파일 순서가 곧 행의 이름이다 — 사용자가 몇째 줄인지로 오류를 찾는다', () => {
    const { rows } = matchRows(
      [row({ ordNo: 'A', itemCd: 'X' }), row({ ordNo: 'B', itemCd: 'Y' })],
      [],
      keys,
    );

    expect(rows.map((entry) => entry.id)).toEqual(['x1', 'x2']);
  });
});
