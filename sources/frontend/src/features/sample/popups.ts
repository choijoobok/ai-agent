import { registerPopups } from '@/shared/popup/registry';
import { MSG } from '@/shared/i18n/messageKeys';
import { SAMPLE_OFFSET_ENDPOINTS } from '@/features/sample/singleoffset/api/endpoints';

/**
 * 샘플의 참조 팝업 — 68 §9.4.
 *
 * <p>**등록은 모듈 로드에서 일어난다.** 이 파일을 임포트한 화면이 열릴 때 등록되고,
 * **`features/sample/` 을 지우면 등록도 함께 사라진다** — 지우는 일이 폴더 하나로 끝나는
 * 것이 68 §10.2 의 규칙이다.
 *
 * <p>**화면 폴더 밖에 있다**(2026-09-02 — ④가 둘째 소비자가 되면서 옮겼다). `types.ts` 와
 * 같은 자리이며 같은 이유다: 고르는 창은 **같은 데이터를 같은 모양으로** 보여야 하는데,
 * 화면마다 등록하면 한쪽만 컬럼이 늘어난다. 폴더가 가르는 것은 **인가 경계**이지 공유할
 * 수 없는 것들의 목록이 아니다.
 *
 * <p>**조회 URL 은 ①의 폴더에 남는다.** 그것이 인가의 근거이고(ADR-0020), 그 URL 을 쓰는
 * 화면은 **자기 `endpoints.ts` 에도 적는다** — 적지 않으면 그 메뉴에 매핑이 없어 403 이다.
 *
 * <p>**키에 네임스페이스가 있다**(`sample.customer`). 없으면 샘플을 걷어낼 때 공통 목록에서
 * 줄을 지워야 하고, 그것은 10 §L 체크리스트에 **없던 항목**이 된다.
 *
 * <p>**조회조건이 없다.** 후보가 다섯이라 검색 폼을 붙이면 *고르러 왔는데 먼저 찾아야* 하는
 * 창이 된다 — `searchFields` 가 선택인 이유가 이것이다.
 *
 * <p>**둘째가 `listModal` 의 것이다**(2026-09-02 · `sample.tag`). grid-column-contract.md §5.6 이 *레지스트리가
 * 정하는 것은 항목을 고르는 팝업이다* 로 갈라 둔 그 자리이며, 같은 한 벌에 있는 것이
 * 요점이다 — `popup` 과 `listModal` 이 각자 목록을 가지면 같은 창을 두 곳에 등록하게 된다.
 */
registerPopups({
  /*
    **태그 후보** — `listModal` 이 항목을 고르는 창이다(grid-column-contract.md §5.6 · 68 §9.6).

    **이것이 없으면 창의 추가 버튼이 아무 일도 하지 않는다.** 모르는 키로 열면 팝업
    호스트가 *취소* 로 돌려주므로(`PopupHost` — 빈 모달을 띄우지 않는다) 사용자에게는
    **눌렀는데 반응이 없는** 버튼이 되고, 진짜 원인은 콘솔에만 남는다.

    **태그 마스터가 없다.** 후보는 이미 자식 테이블에 있는 것이며(48 §2 가 담는 테이블을
    둘로 정했다) 고객 후보를 주문에서 뽑는 것과 같은 대역이다 — 그래서 이 창에서 **새
    태그를 만들 수는 없다**. 타이핑을 열지 않기로 한 결과이고(grid-column-contract.md §5.6), 사용 프로젝트에
    태그 마스터가 생기면 바뀌는 것은 서버의 `from` 하나다.
  */
  'sample.tag': {
    title: MSG.SAMPLE_POPUP_TAG,
    read: { url: SAMPLE_OFFSET_ENDPOINTS.getTagCandidateList },
    width: 420,
    /*
      **⑤의 태그 탭과 같은 헤더 키를 쓴다.** 새로 만들면 같은 컬럼이 고르는 창과 편집하는
      그리드에서 다른 이름으로 보이는 날이 온다(`SampleDetailTabs` 의 머리말).

      **정렬을 켜지 않는다.** 후보가 아홉이고 서버가 이름순으로 주므로, 켜면 사용자가
      **고르러 온 창에서 정렬을 만지는** 일이 생긴다.
    */
    columns: [
      { field: 'tagNm', header: MSG.SAMPLE_COL_TAG_NM, type: 'text', width: 160 },
      {
        field: 'tagTypeCd',
        header: MSG.SAMPLE_COL_TAG_TYPE,
        type: 'code',
        width: 120,
        grpCd: 'SMPL_TAG_TYPE',
        renderer: 'badge',
        // ⑤의 탭과 같은 tone 맵이다 — 고르는 창과 고른 뒤의 색이 갈리면 같은 값이 다른
        // 것으로 읽힌다(grid-column-contract.md §5.4.1).
        tone: { GEN: 'none', PROMO: 'ok', RISK: 'warn' },
      },
    ],
  },
  'sample.customer': {
    title: MSG.SAMPLE_POPUP_CUSTOMER,
    read: { url: SAMPLE_OFFSET_ENDPOINTS.getCustomerList },
    width: 520,
    /*
      **읽기 전용 목록이라 `editable` 이 없다.** 고르는 창에서 값을 고치면 그 편집은
      아무 데도 저장되지 않는다 — 저장 버튼이 없는 그리드다(PopupSpec).

      등급을 함께 내는 것은 `apply` 가 그것까지 채우기 때문이다(grid-column-contract.md §6.3) — 고르는 사람이
      화면에서 등급을 보지 못하면 **무엇이 함께 들어오는지 모른 채** 고르게 된다.
    */
    columns: [
      {
        field: 'custId',
        header: MSG.SAMPLE_POPUP_CUSTOMER_ID,
        type: 'text',
        width: 120,
        sortable: true,
      },
      {
        field: 'custNm',
        header: MSG.SAMPLE_POPUP_CUSTOMER_NM,
        type: 'text',
        width: 200,
        sortable: true,
      },
      {
        field: 'custGrdCd',
        header: MSG.SAMPLE_POPUP_CUSTOMER_GRD,
        type: 'code',
        width: 100,
        grpCd: 'SMPL_CUST_GRD',
        renderer: 'badge',
        // 그리드 셀과 같은 tone 맵이다 — 고르는 창과 고른 뒤의 색이 갈리면 같은 값이
        // 다른 것으로 읽힌다(grid-column-contract.md §5.4.1).
        tone: { VIP: 'ok', GOLD: 'warn', SILVER: 'none', BRONZE: 'muted' },
      },
    ],
  },
});
