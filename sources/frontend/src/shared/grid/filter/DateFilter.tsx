import { useCallback } from 'react';
import { useGridFilter, type CustomFilterProps } from 'ag-grid-react';
import { Button, DatePicker, Space } from 'antd';
import dayjs from 'dayjs';
import type { IRowNode } from 'ag-grid-community';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { datePattern, type DatePrecision } from '@/shared/grid/dateFormat';
import {
  passesDateFilter,
  toDateModel,
  type DateFilterModel,
} from '@/shared/grid/filter/dateFilterModel';

/**
 * 날짜 필터 — frontend/grid.md · playbook/INDEX.md. <b>판의 텍스트 입력을 달력으로 갈아 끼운다.</b>
 *
 * <p>AG Grid 의 날짜 필터는 <b>사람이 {@code 2026-08-27} 을 직접 치는 칸</b>이고, 형식이
 * 틀리면 조용히 걸리지 않는다 — 필터를 걸었는데 아무 일도 안 일어난 것처럼 보인다.
 *
 * <p><b>검색 폼과 같은 달력을 쓴다</b>(AntD {@code DatePicker}). 다르면 같은 화면에서
 * 날짜를 고르는 방법이 둘이 되고, 테마도 갈린다 — AntD 는 frontend/tabs.md 의 토큰을 이미 받지만
 * 판의 내장 입력은 AG Grid 쪽 테마를 따른다.
 *
 * <p><b>정밀도가 달력을 정한다</b>(frontend/grid.md의 표). 년월 컬럼에서 일을 고르게 하면 그 값은
 * <i>고를 수 없는 자릿수</i> 이며, 사용자는 자기가 고른 일이 무시된다는 것을 알 수 없다.
 *
 * <p><b>한쪽만 채우면 단측이다</b> — 반대쪽 끝에 사람이 아무 값이나 넣게 하면 그 값이
 * 곧 조건이 된다(검색 폼의 {@code gte}·{@code lte} 와 같은 자리 · screen/user/requirements.md).
 */
export interface DateFilterParams {
  precision: DatePrecision;
}

/** 정밀도 → 달력의 모양. {@code month} 는 일 선택이 아예 없다. */
const PICKER: Record<DatePrecision, 'date' | 'month'> = {
  month: 'month',
  day: 'date',
  second: 'date',
};

export function DateFilter(props: CustomFilterProps & DateFilterParams) {
  const { precision } = props;
  const model = props.model as DateFilterModel | null;
  const { onModelChange, getValue } = props;

  const doesFilterPass = useCallback(
    (params: { node: IRowNode }) => passesDateFilter(getValue(params.node), model, precision),
    [getValue, model, precision],
  );

  useGridFilter({ doesFilterPass });

  const format = datePattern(precision);
  const pair: [string | null, string | null] = [model?.from ?? null, model?.to ?? null];

  const change = (index: 0 | 1, value: string | null) => {
    const next: [string | null, string | null] = [...pair];
    next[index] = value;
    onModelChange(toDateModel(next[0], next[1]));
  };

  /*
    <b>{@code RangePicker} 가 아니라 달력 <i>둘</i> 이다.</b> 범위 컨트롤은 두 끝을 함께
    받으므로 <b>한쪽만 고를 수가 없고</b>, 그것이 이 필터의 계약이다(단측). 검색 폼이
    같은 문제를 만났을 때도 {@code gte}·{@code lte} 에서 달력 하나로 갈랐다(screen/user/requirements.md) —
    거기서는 <i>연산자</i> 가 축이었고 여기서는 <b>두 칸이 각자 비어 있을 수 있다</b>.
  */
  const picker = (index: 0 | 1, placeholder: string) => (
    <DatePicker
      allowClear
      picker={PICKER[precision]}
      showTime={precision === 'second' ? { defaultValue: defaultTimeOf(index) } : false}
      format={format}
      placeholder={label(placeholder)}
      value={pair[index] === null ? null : dayjs(pair[index])}
      onChange={(picked) => change(index, picked ? picked.toISOString() : null)}
      style={{ width: '100%' }}
    />
  );

  return (
    <div style={{ padding: 8, minWidth: 220 }}>
      <Space direction="vertical" size={6} style={{ width: '100%' }}>
        {picker(0, MSG.GRID_FILTER_FROM)}
        {picker(1, MSG.GRID_FILTER_TO)}
        {/*
          <b>지우는 버튼이 따로 있다.</b> 칸마다 있는 × 로도 지울 수 있지만 두 번 눌러야
          하고, 필터를 <i>푸는</i> 것은 거는 것보다 급한 동작이다 — 걸어 둔 것을 잊고
          조회하면 <b>0건이 데이터가 없는 것으로</b> 읽힌다.
        */}
        <Button
          size="small"
          disabled={pair[0] === null && pair[1] === null}
          onClick={() => onModelChange(null)}
        >
          {label(MSG.GRID_FILTER_CLEAR)}
        </Button>
      </Space>
    </div>
  );
}

/**
 * 시분초 칸의 <b>비워 둔 시각</b> — frontend/grid.md 의 <i>시작은 00:00:00, 끝은 23:59:59</i>.
 *
 * <p>비교할 때가 아니라 <b>고를 때</b> 채운다. 비교에서 채우면 사용자가 <i>일부러 고른
 * 자정</i> 과 <i>고르지 않아 자정인 것</i>을 구별할 수 없고, 그러면 00:00:00 을 고른
 * 사람의 조건이 말없이 하루 끝으로 밀린다.
 */
function defaultTimeOf(index: 0 | 1) {
  return index === 0 ? dayjs().startOf('day') : dayjs().endOf('day');
}
