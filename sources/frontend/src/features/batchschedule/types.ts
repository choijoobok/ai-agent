import type { BatchResultCode } from '@/shared/batch/batchCodes';

/** 서버 `BatchScheduleRow` 와 1:1 — screen/batch/schedule/requirements.md. */
export interface BatchScheduleRow {
  /** 기본 정렬. <b>사람이 정한다</b> — 드래그가 아니라 숫자다(screen/batch/schedule/requirements.md). */
  sortNo: number | null;
  /** PK 이자 <b>락 키</b>다(backend/persistence.md). 신규 행에서만 편집된다(sys/user-role.md). */
  batchId: string;
  /** <b>필수</b>. 관리자 전용 명칭이라 다국어가 아니다(sys/batch.md). */
  batchNm: string;
  /**
   * <b>필수</b>다 — sys/batch.md · screen/batch/schedule/requirements.md.
   *
   * <p>*무엇을 하는가* · **끄면 무엇이 멈추는가** · *되돌릴 수 있는가* 를 적는다. 셋째가
   * 특히 중요한데, **껐다 켜면 따라잡는 배치**와 **건너뛴 구간이 영영 비는 배치**는 끄는
   * 결정의 무게가 다르고 `CRON` 과 `USE_YN` 은 그 차이를 표현하지 못한다.
   *
   * <p>이 문장을 <b>끄는 확인 창이 그대로 읽어 준다</b>(screen/batch/schedule/requirements.md) — 비어 있으면 그 확인이
   * 아무 말도 하지 않는다.
   */
  batchDesc: string;
  /** `BatchJob` 구현의 빈 이름. <b>타이핑이 아니라 고르는 것</b>이다(screen/batch/schedule/requirements.md). */
  beanId: string;
  /** 크론 표현식. 저장이 쿨다운과의 <b>관계</b>를 검증한다(screen/batch/schedule/requirements.md). */
  cron: string;
  /**
   * 파생 — <b>서버가 계산한다</b>(screen/batch/schedule/requirements.md). 크론 파서가 프론트 의존성에 없다.
   *
   * <p><b>`null` 인 경우가 둘이고 뜻이 다르다.</b> 꺼 둔 배치는 스케줄러가 등록조차 하지
   * 않아 비고(screen/batch/schedule/requirements.md), 크론을 읽지 못한 배치도 빈다 — 후자는 <b>고장의 신호</b>이며
   * `최근 결과` 가 함께 말해 준다.
   */
  nextExecDtm: string | null;
  /** `nclob` 이 아니다(`VARCHAR(2000)`) — 값이 손에 있으므로 `textModal` 이다(screen/batch/schedule/requirements.md). */
  paramJson: string | null;
  /** 장애 안전망. <b>실행 이력의 유령 판정도 이 값을 쓴다</b>(screen/batch/schedule/requirements.md). */
  lockExpirySec: number | null;
  /** 쿨다운 — 크론 최소 간격보다 길면 저장이 거부한다(backend/persistence.md). */
  lockMinIntervalSec: number | null;
  /** 스위치지만 <b>즉시 저장이 아니다</b>(frontend/grid.md · screen/batch/schedule/requirements.md). */
  useYn: boolean;
  /**
   * 파생 — 하단 pane 첫 행과 <b>같은 값</b>이다(screen/batch/schedule/requirements.md).
   *
   * <p>`null` 은 <b>한 번도 안 돌았다</b> 이며 `0` 건과 같은 부류의 구분이다 — 화면이
   * `—` 로 그린다. screen/batch/schedule/requirements.md 이 *"행이 없으면 꺼져 있는 것"* 이라고 한 그 신호이기도 하다.
   */
  lastRsltCd: BatchResultCode | null;
  /**
   * 파생 — <b>삭제 게이트의 한쪽</b>이다(screen/batch/schedule/requirements.md).
   *
   * <p>`lastRsltCd` 로 대신하지 않는다. *가장 최근 실행이 `RUNNING`* 과 *`RUNNING` 인
   * 실행이 있다* 는 다르다 — 유령이 남은 채 다음 주기가 성공하면 최근 결과는 `SUCCESS`
   * 인데 `RUNNING` 행은 남아 있다(screen/batch/schedule/requirements.md).
   */
  running: boolean;
  regId: string | null;
  regDtm: string | null;
  modId: string | null;
  modDtm: string | null;
}

/** 즉시 실행의 응답 — 건별이다(frontend/grid.md · screen/batch/schedule/requirements.md). */
export interface BatchRunResponse {
  items: BatchRunItem[];
}

export interface BatchRunItem {
  batchId: string;
  /** 시작했는가. `false` 면 아래 둘이 이유를 나른다. */
  started: boolean;
  /**
   * 이미 도는 노드 — <b>`null` 일 수 있다</b>.
   *
   * <p>락은 잡혔는데 `RUNNING` 이력이 아직 없는 짧은 창이며, 그때 화면은 노드 없는 문구를
   * 낸다. <b>문구를 서버가 짓지 않는 것</b>이 요점이다 — 정상 응답이라 서버의 언어로 굳을
   * 이유가 없다(backend/packages.md 가 오류 문구에서 감수한 대가와 다른 자리).
   */
  runningNodeId: string | null;
  /** 그 실행의 시작 시각 — 운영자가 <b>얼마나 기다려야 하는지</b> 를 재는 값이다. */
  runningStartedAt: string | null;
}
