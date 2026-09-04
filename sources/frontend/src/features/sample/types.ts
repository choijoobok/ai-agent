/**
 * 샘플 주문과 품목 — playbook/INDEX.md.
 *
 * <p><b>식별자가 문자열이다</b>(frontend/packages.md). `bigint` 어휘가 뜻을 가지려면 API 가 문자열로
 * 내려야 한다 — 자바스크립트의 수는 2^53 을 넘기면 조용히 정밀도를 잃고, 그 손실은
 * 화면이 아니라 <b>저장 요청이 다른 행을 가리키는 것</b>으로 드러난다.
 */
export interface SampleOrder {
  ordId: string | null;
  ordNo: string;
  ordNm: string;
  custId: string;
  custNm: string;
  ordStatCd: string;
  ordDt: string | null;
  ordDtm: string | null;
  ordQty: number;
  unitAmt: number | null;
  ordAmt: number | null;
  vatAmt: number | null;
  dcRt: number | null;
  urgentYn: boolean;
  useYn: boolean;
  /** `hidden` 이다 — 그리지 않고 `editable` 함수만 읽는다(playbook/INDEX.md). */
  lockYn: boolean;
  errMsg: string | null;
  /** 마스터 삭제 게이트의 근거 — frontend/grid.md. 행마다 물으면 왕복이 스물이다. */
  itemCnt: number;
  regId: string | null;
  regDtm: string | null;
  modId: string | null;
  modDtm: string | null;
}

export interface SampleOrderItem {
  ordId: string | null;
  itemSeq: number | null;
  ordNo: string;
  itemCd: string;
  itemNm: string;
  uomCd: string;
  qty: number | null;
  unitAmt: number | null;
  amt: number | null;
  dlvrDt: string | null;
  itemStatCd: string;
  useYn: boolean;
  rmk: string | null;
  regId: string | null;
  regDtm: string | null;
  modId: string | null;
  modDtm: string | null;
}

/**
 * `TAG_LIST` 의 한 항목 — playbook/INDEX.md 의 21번 컬럼.
 *
 * <p><b>문자열이 아니라 객체다.</b> frontend/grid.md 이 `list` 항목을 객체로 열어 두었고, 문자열
 * 배열만 다루면 **그 문이 열려 있다는 사실에 실물이 없다**. 무엇을 보일지는 컬럼의
 * `display` 가 정한다.
 */
export interface SampleTag {
  tagNm: string;
  tagTypeCd: string;
}

/**
 * ①이 그리는 한 행 — playbook/INDEX.md 의 **컬럼 서른**.
 *
 * <p>{@link SampleOrder} 와 갈리는 이유는 서버의 `SmplOrderFullRow` 가 적어 두었다 —
 * ③은 아홉을 그리고 이 화면은 서른을 그리므로, 한 타입으로 합치면 ③이 그리지도 않는
 * `nclob` 셋과 태그를 페이지마다 나른다.
 *
 * <p><b>`itemCnt` 가 없다.</b> 이 화면에는 마스터 삭제 게이트가 없다(playbook/INDEX.md 의 커버리지 표) —
 * 삭제 컬럼은 있지만 조건 없이 열리며, 품목이 있는 주문을 지우려 하면 **서버가 사유를 담아
 * 거절한다**. 게이트는 ③④⑤의 어휘다.
 *
 * <p><b>`procMs` 만 숫자다.</b> `ordId` 는 문자열이고(frontend/packages.md 의 `bigint`) 이것은 숫자인데,
 * 규칙이 *`bigint` 는 문자열* 이 아니라 **정밀도를 잃을 수 있으면 문자열**이기 때문이다 —
 * 소요 시간은 2^53 근처에 갈 수 없고, `renderer:'duration'` 은 밀리초 원본을 읽는다.
 */
export interface SampleOrderFull {
  ordId: string | null;
  ordNo: string;
  ordNm: string;
  custId: string;
  custNm: string;
  custGrdCd: string | null;
  ordStatCd: string;
  chnlCd: string;
  priorityCd: string;
  ordDt: string | null;
  /** `precision:'month'` — `202608` 문자열이다(playbook/INDEX.md). */
  dlvrYm: string | null;
  ordDtm: string | null;
  ordQty: number;
  unitAmt: number | null;
  ordAmt: number | null;
  vatAmt: number | null;
  dcRt: number | null;
  procMs: number | null;
  urgentYn: boolean;
  useYn: boolean;
  /** 태그가 없는 주문은 **빈 배열**이다 — `null` 이면 *없음* 과 *모름* 이 갈린다. */
  tagList: SampleTag[];
  memo: string | null;
  rmk: string | null;
  errMsg: string | null;
  /** `hidden` 이다 — 그리지 않고 `editable` 함수만 근거로 읽는다(playbook/INDEX.md). */
  lockYn: boolean;
  /** `visible:false` 다 — 기본 숨김이며 설정 창에서 사용자가 켠다(frontend/grid.md). */
  srcSysCd: string | null;
  regId: string | null;
  regDtm: string | null;
  modId: string | null;
  modDtm: string | null;
}

/**
 * ②가 그리는 한 행 — playbook/INDEX.md 의 **읽기 열둘**.
 *
 * <p>이 화면은 **조회 전용**이라(액션 `R E`) 편집용 컬럼이 자리를 차지할 이유가 없다.
 * {@link SampleOrderFull} 이 서른을 내는 것과 갈리는 자리이며, 여기에 서른을 실으면
 * **대용량 이력의 대리**라는 이 화면의 역할이 무너진다.
 *
 * <p>**`ordId` 는 그리지 않는데 싣는다.** playbook/INDEX.md 의 열둘에 없지만 그리드가 행을 가리킬
 * 키가 있어야 하고, 커서의 기준점도 이 값이다 — **보이는 것과 필요한 것이 같지 않다**.
 */
export interface SampleOrderCursor {
  ordId: string | null;
  ordNo: string;
  ordNm: string;
  custNm: string;
  custGrdCd: string | null;
  ordStatCd: string;
  ordDt: string | null;
  ordDtm: string | null;
  ordQty: number;
  ordAmt: number | null;
  dcRt: number | null;
  procMs: number | null;
  errMsg: string | null;
}

/**
 * ⑤의 태그 탭이 그리는 한 행 — playbook/INDEX.md.
 *
 * <p>**{@link SampleTag} 와 같은 데이터의 다른 모양이다.** 저쪽은 ①의 `list` 컬럼이 나르는
 * **항목**이라 둘뿐이고, 이쪽은 **행**이라 키와 순서와 감사 컬럼을 함께 싣는다 —
 * playbook/INDEX.md 의 *"배열은 화면의 어휘이고 저장은 자식 테이블"* 이 두 타입을 나란히 놓아야
 * 눈에 보인다.
 *
 * <p>**`tagSeq` 와 `sortNo` 가 둘 다 있다.** ①에서는 같은 값이었다(배열의 색인이 곧
 * 순서다). 행으로 편집하면 **순번을 유지한 채 순서만** 바꿀 수 있고, 그 갈림이 이 화면에서
 * 처음 실물이 된다.
 */
export interface SampleOrderTagRow {
  ordId: string | null;
  tagSeq: number | null;
  tagNm: string;
  tagTypeCd: string;
  sortNo: number | null;
  regId: string | null;
  regDtm: string | null;
  modId: string | null;
  modDtm: string | null;
}

/** 참조 팝업이 돌려주는 행 — playbook/INDEX.md 의 `sample.customer`. */
export interface SampleCustomer {
  custId: string;
  custNm: string;
  custGrdCd: string | null;
}
