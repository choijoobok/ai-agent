package com.ordinary.backoffice.domain.batch;

/**
 * 실행 구분 — 46 §6 · 65 §2.3. <b>둘뿐이고 공통코드가 아니다.</b>
 *
 * <p>{@link BatchResultCode} 와 같은 이유로 소스가 값을 갖는다. 라벨만 메시지 키
 * ({@code batch.execType.*})다.
 *
 * <h2>둘을 가르는 것이 진단의 첫 단계다</h2>
 *
 * <p>31 §8 의 중복 진단 표가 <i>"같은 배치 2건, {@code NODE_ID} 동일"</i> 을 <b>재시도
 * 또는 수동 실행</b>으로 읽는다(65 §4.6). 그 둘을 가르는 유일한 값이 이 컬럼이며,
 * 없으면 <i>"왜 두 번 돌았나"</i> 에서 <b>사람이 눌렀다</b> 를 배제할 수 없다.
 */
public enum BatchExecType {

    /** 크론이 깨웠다. */
    SCHEDULE,

    /**
     * 사람이 <b>즉시 실행</b>을 눌렀다 — BATCH-02 · 65 §3.7.
     *
     * <p><b>쿨다운을 우회한다</b>(31 §7). 그래서 이 구분으로 시작한 실행에는
     * {@link BatchResultCode#SKIP_COOLDOWN} 이 <b>있을 수 없다</b> — 있으면 러너가
     * 우회하지 않은 것이다.
     */
    MANUAL
}
