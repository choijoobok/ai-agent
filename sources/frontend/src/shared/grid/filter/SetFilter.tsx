import { useCallback, useState } from 'react';
import { useGridFilter, type CustomFilterProps } from 'ag-grid-react';
import { Checkbox, Divider, Switch, theme } from 'antd';
import type { IRowNode } from 'ag-grid-community';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import { SWITCH_WIDTH } from '@/shared/grid/columnDefs';
import { keyOf, toModel, type SetFilterModel } from '@/shared/grid/filter/setFilterModel';
import type { SelectOption } from '@/shared/grid/types';

/**
 * `set` 필터 — grid-column-contract.md §4.3. <b>고르는 필터</b>이며 치는 필터가 아니다.
 *
 * <p><b>코드 컬럼에 텍스트 필터를 두면 안 된다.</b> 사용자는 화면에 보이는 <i>이름</i> 을
 * 치는데 판은 <i>코드값</i> 을 비교한다 — 아무것도 안 걸리고, 왜 안 걸리는지 알 수 없다.
 *
 * <p><b>판의 Enterprise 기능을 쓰지 않는다.</b> AG Grid 의 `agSetColumnFilter` 는 유료판의
 * 것이고 이 저장소는 Community 다(ADR-0018 · ADR-0004 의 <i>유료 라이선스는 배제한다</i>).
 * 판이 여는 <b>커스텀 필터</b> 확장점으로 직접 만든다 — 어휘는 우리 것이므로 판을 바꿔도
 * 이 파일만 바뀐다.
 *
 * <p><b>목록은 로드된 행에서 모은다</b>(grid-column-contract.md §4.4) — 결과 내 필터이므로(§4.1) <b>지금 화면에
 * 없는 값을 고를 이유가 없다.</b> 코드 마스터 전체를 내려받으면 목록의 대부분이 0건이고,
 * 사용자는 <i>"골랐는데 아무것도 안 나온다"</i> 를 겪는다.
 *
 * <p><b>{@code ynFlag} 만 예외다.</b> 값의 집합이 둘로 닫혀 있으므로 로드된 행에 한쪽이
 * 없어도 <b>둘 다 보여준다</b> — <i>"켜진 것만 보기"</i> 는 <b>꺼진 것이 없을 때도</b>
 * 사용자가 물을 수 있는 질문이다.
 *
 * <p><b>전부 고른 상태는 필터가 아니다.</b> 모델을 {@code null} 로 되돌린다 — 그러지 않으면
 * 푸터의 <i>N건 중 M건</i> 표기가 걸리지 않은 필터를 걸린 것으로 말한다(grid-standard.md §2.3).
 */
export interface SetFilterParams {
  kind: 'code' | 'ynFlag';
  /** 코드값 → 이름. 없는 값은 값 그대로 보인다. */
  options?: SelectOption[];
}

export function SetFilter(props: CustomFilterProps & SetFilterParams) {
  const { token } = theme.useToken();
  const model = props.model as SetFilterModel | null;
  const { onModelChange, getValue, api } = props;
  const [keys, setKeys] = useState<string[]>([]);

  const doesFilterPass = useCallback(
    (params: { node: IRowNode }) => {
      const chosen = model?.values;
      if (!chosen) return true;
      return chosen.includes(keyOf(getValue(params.node)));
    },
    [model, getValue],
  );

  /**
   * 열릴 때마다 목록을 다시 모은다 — 조회가 돌면 값 집합이 바뀐다.
   *
   * <p>여는 순간이 유일하게 맞는 시점이다. 행이 바뀔 때마다 모으면 <b>필터를 걸어 둔 채
   * 조회한 사용자의 목록에서 방금 고른 값이 사라진다</b>.
   */
  const afterGuiAttached = useCallback(() => {
    if (props.kind === 'ynFlag') {
      // 집합이 둘로 닫혀 있다 — 로드된 행에 한쪽이 없어도 물을 수 있는 질문이다.
      setKeys(['Y', 'N']);
      return;
    }
    const found = new Set<string>();
    api.forEachNode((node) => found.add(keyOf(getValue(node))));
    // 선언한 순서를 지키고, 선언에 없는 값은 뒤에 붙인다.
    const declared = (props.options ?? []).map((option) => option.value);
    const rest = [...found].filter((value) => !declared.includes(value)).sort();
    setKeys([...declared.filter((value) => found.has(value)), ...rest]);
  }, [api, getValue, props.kind, props.options]);

  useGridFilter({ doesFilterPass, afterGuiAttached });

  const chosen = model?.values ?? keys;
  const allChosen = keys.length > 0 && chosen.length === keys.length;

  const change = (next: string[]) => onModelChange(toModel(next, keys.length));

  const text = (key: string) => {
    const option = props.options?.find((candidate) => candidate.value === key);
    if (option) return option.text;
    return key === '' ? label(MSG.GRID_FILTER_BLANK) : key;
  };

  return (
    <div style={{ padding: 8, minWidth: 180, maxHeight: 320, overflowY: 'auto' }}>
      <Checkbox
        checked={allChosen}
        indeterminate={chosen.length > 0 && !allChosen}
        onChange={(event) => change(event.target.checked ? [...keys] : [])}
      >
        {label(MSG.GRID_FILTER_ALL)}
      </Checkbox>
      <Divider style={{ margin: '8px 0' }} />

      {keys.length === 0 ? (
        <span style={{ color: token.colorTextTertiary }}>{label(MSG.GRID_FILTER_EMPTY)}</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {keys.map((key) => (
            <Checkbox
              key={key}
              checked={chosen.includes(key)}
              onChange={(event) =>
                change(
                  event.target.checked
                    ? [...chosen, key]
                    : chosen.filter((candidate) => candidate !== key),
                )}
            >
              {/* 스위치 컬럼의 항목은 <b>그 스위치</b>다 — Y·N 이라는 글자는 셀에 없다. */}
              {props.kind === 'ynFlag' ? (
                <Switch
                  size="small"
                  style={{ minWidth: SWITCH_WIDTH }}
                  checked={key === 'Y'}
                  disabled
                />
              ) : (
                text(key)
              )}
            </Checkbox>
          ))}
        </div>
      )}
    </div>
  );
}
