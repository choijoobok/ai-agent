import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { Button, Pagination, Select, Space, Tooltip, Typography, theme } from 'antd';
import { label } from '@/shared/i18n/label';
import { MSG } from '@/shared/i18n/messageKeys';
import type { PageMode } from '@/shared/grid/types';

/**
 * 페이지 이동 넷의 이름 — 판이 아이콘만 그리므로 <b>말하는 자리가 툴팁뿐</b>이다.
 *
 * <p>숫자 항목(`page`)은 여기 없다. 그 위에 같은 숫자를 띄우는 것은 말을 더하는 것이
 * 아니라 가리는 것이다.
 */
const NAV_TOOLTIP: Record<string, string | undefined> = {
  prev: MSG.GRID_PAGE_PREV,
  next: MSG.GRID_PAGE_NEXT,
  'jump-prev': MSG.GRID_PAGE_JUMP_PREV,
  'jump-next': MSG.GRID_PAGE_JUMP_NEXT,
};

/**
 * 그리드 푸터 — grid-standard.md §2.3.
 *
 * <p><b>모양을 화면이 선언하지 않는다 — 응답의 {@code mode} 가 정한다</b>(api-conventions.md §3.8).
 * 화면이 한 번 더 적으면 미러링이고, 어긋날 때 어느 쪽이 맞는지 알 수 없다.
 *
 * <p><b>페이지 목록은 그리드 <i>가운데</i>다</b> — 건수 문구는 왼쪽, 쪽수 콤보는 오른쪽에
 * 두고 가운데 칸만 페이지 번호가 쓴다. 셋을 오른쪽에 몰아 두면 번호를 누르려고 눈이
 * 화면 끝까지 간다.
 *
 * <p><b>커서형은 세 칸 중 가운데가 다르다</b>(64 §2.3). 총 건수를 세지 않기로 했으므로
 * (상한·근사·생략 중 <b>생략</b>) 페이지 번호를 만들 수 없고, 왼쪽은 <i>총 N건</i> 대신
 * <b>{@code N건 조회됨}</b> 이 된다 — <b>grid-standard.md §2.3 의 3분할에서 한 칸을 잃는 유일한 예외</b>다.
 *
 * <p><b>컬럼 필터는 총 건수를 바꾸지 않는다</b>(grid-column-contract.md §4.2). 필터가 거른 결과는 덧붙은 문구로만
 * 나타나며, 그 표기가 <i>"필터가 현재 페이지에만 걸린다"</i> 를 사용자에게 알리는 유일한
 * 자리다.
 */

/**
 * 쪽수 후보의 기본값 — grid-standard.md §2.3.
 *
 * <p><b>백오피스는 한 화면에 많이 놓고 훑는다.</b> 스무 줄씩 넘기는 것은 <i>찾는</i> 일에
 * 맞는 크기이고, 여기서 흔한 일은 <b>죽 훑어 내리다 하나를 집는</b> 것이다.
 *
 * <p><b>맨 위가 1000 인 것은 서버의 상한이다</b>({@code PageSpec.MAX_SIZE}) — 후보에
 * 상한을 넘는 값을 두면 고르는 순간 400 이 난다.
 */
const DEFAULT_PAGE_SIZES = [100, 500, 1000];

interface GridFooterProps {
  /** 화면이 다른 후보를 줄 수 있다 — 안 주면 {@link DEFAULT_PAGE_SIZES}. */
  pageSizes?: number[];
  mode: PageMode;
  page: number;
  size: number;
  total: number | null;
  totalPages: number | null;
  /** 그리드에 로드된 행 수. */
  loaded: number;
  /** 컬럼 필터를 통과해 지금 보이는 행 수. */
  shown: number;
  /**
   * 커서형에서 건수 뒤에 덧붙는 한마디 — {@code 최근 1일} 같은 것(64 §2.3).
   *
   * <p><b>총 건수를 잃은 자리를 메운다.</b> <i>N건 조회됨</i> 만 있으면 <i>"전부가 N건"</i>
   * 으로 읽히는데 실제로는 <b>이 장이 N건</b>이다 — 무엇을 물어서 나온 N건인지가 함께
   * 있어야 그 오독이 생기지 않는다. 푸터가 만들 수 없는 문구라 화면이 준다.
   */
  note?: string;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
  onNext: () => void;
  onPrev: () => void;
  hasNext: boolean;
  hasPrev: boolean;
}

export function GridFooter(props: GridFooterProps) {
  const { token } = theme.useToken();
  const { mode, page, size, total, totalPages, loaded, shown } = props;
  const filtered = shown !== loaded;
  const cursor = mode === 'cursor';

  return (
    <div
      style={{
        // 세 칸이다 — 양끝이 `1fr` 이라야 가운데 칸이 <b>그리드의 가운데</b>에 온다.
        // `space-between` 으로 두면 왼쪽 문구가 길어질 때마다 페이지 목록이 밀린다.
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: 12,
        // 버튼 줄과 같은 여백이다 — 페이지 버튼도 그리드 선에 붙어 보였다(2026-08-30 실물).
        padding: '8px 8px',
        /*
          <b>{@code mode} 가 높이를 바꾸지 않는다.</b> {@code all} 이면 가운데와 오른쪽이
          비어 건수 한 줄만 남는데, 그러면 <b>같은 화면의 그리드 둘이 다른 바닥</b>을 갖는다
          (제목 줄이 같은 이유로 바닥값을 갖는다 — {@code GridHeader}).

          트리 그리드도 <b>같은 값을 선언</b>한다(62 §4.2.2) — 위아래로 놓인 트리와 그리드의
          판 바닥이 어긋나면 스플리터를 옮길 때마다 그 차이가 눈에 띈다.
        */
        minHeight: token.controlHeight + 16,
      }}
    >
      <Typography.Text type="secondary">
        {mode === 'all' ? label(MSG.GRID_FOOTER_COUNT, { count: loaded }) : null}
        {/* 총 건수가 없다 — 이 장이 몇 건인지만 말한다(64 §2.3). */}
        {cursor ? label(MSG.GRID_FOOTER_LOADED, { count: loaded }) : null}
        {mode === 'offset'
          ? label(MSG.GRID_FOOTER_TOTAL, { total: total ?? 0, pages: totalPages ?? 0 })
          : null}
        {cursor && props.note ? ` · ${props.note}` : ''}
        {filtered ? ` · ${label(MSG.GRID_FOOTER_FILTERED, { loaded, shown })}` : ''}
      </Typography.Text>

      {/* mode 가 all 이면 네비도 사이즈 콤보도 없다 — 페이지가 없으므로 고를 것이 없다. */}
      <div style={{ justifySelf: 'center' }}>
        {/*
          <b>번호가 없다</b> — 총 건수를 세지 않으므로 몇 페이지인지 알 수 없고, 알 수 없는
          것을 그리면 <i>3페이지로 건너뛰기</i> 가 눌리는데 갈 수 없다(64 §2.3).
        */}
        {cursor ? (
          <Space size={4}>
            <Button
              size="small"
              icon={<LeftOutlined />}
              disabled={!props.hasPrev}
              onClick={props.onPrev}
            >
              {label(MSG.GRID_PAGE_PREV)}
            </Button>
            <Button
              size="small"
              disabled={!props.hasNext}
              onClick={props.onNext}
            >
              {label(MSG.GRID_PAGE_NEXT)}
              <RightOutlined />
            </Button>
          </Space>
        ) : null}
        {mode !== 'offset' ? null : (
          <Pagination
            simple={false}
            current={page + 1}
            pageSize={size}
            total={total ?? 0}
            showSizeChanger={false}
            // 판이 페이지 번호마다 브라우저 기본 툴팁을 단다 — 셸의 다른 툴팁과 모양이
            // 다르고, 숫자 위에 같은 숫자가 뜨는 것이라 말하는 것도 없다.
            showTitle={false}
            /*
              <b>이동 넷에만 툴팁을 단다</b>(2026-08-30 실물). 판의 기본 툴팁은 브라우저
              것이라 셸의 다른 툴팁과 모양이 다르고, 무엇보다 <b>숫자 위에 같은 숫자</b>를
              띄운다 — 그래서 `showTitle` 은 끈 채로 두고 뜻이 있는 넷만 감싼다.

              가운데 둘(`jump-*`)은 <b>다섯 페이지</b>씩 뛴다 — 판의 기본값이며 점 셋으로만
              그려져 몇 페이지인지 알 길이 없다.
            */
            itemRender={(_, type, element) => {
              const title = NAV_TOOLTIP[type];
              return title ? <Tooltip title={label(title)}>{element}</Tooltip> : element;
            }}
            onChange={(next) => props.onPage(next - 1)}
          />
        )}
      </div>

      {/* 쪽수 콤보는 커서형에도 남는다 — 한 장에 몇 건을 볼지는 여전히 고를 수 있다. */}
      <div style={{ justifySelf: 'end' }}>
        {mode === 'all' ? null : (
          <Select
            value={size}
            style={{ width: 120 }}
            onChange={props.onSize}
            // `title: ''` 는 <b>브라우저 기본 툴팁을 끄는 것</b>이다 — 판은 고른 항목의
            // 글자를 그대로 `title` 에 넣어 두는데, 여기서는 보이는 글자를 한 번 더
            // 띄우는 것뿐이다(2026-08-30 실물).
            options={(props.pageSizes ?? DEFAULT_PAGE_SIZES).map((value) => ({
              value,
              title: '',
              label: label(MSG.GRID_FOOTER_PAGE_SIZE, { size: value }),
            }))}
          />
        )}
      </div>
    </div>
  );
}
