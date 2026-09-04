package com.ordinary.backoffice.domain.progress;

/**
 * 진행률 작업의 상태 셋 — 30 §6 · 46 §8.
 *
 * <p><b>공통코드가 아니다.</b> 값에 따라 화면이 갈리므로(도는 막대 · 완료 · 실패 사유)
 * 소스가 값을 가져야 한다 — 43 §4.4 의 {@code ACTION_CD} 와 같은 자리다. 관리자가 값을
 * 하나 늘려도 그것을 그릴 화면이 없다.
 */
public enum JobStatus {

    /**
     * <b>시작하면서 미리 적재한다</b>(30 §6) — 첫 폴링이 <i>없음</i> 을 받지 않게 하기
     * 위해서다. 그 응답을 받은 화면은 작업이 <b>실패한 것</b>과 구별할 수 없다.
     */
    RUNNING,

    DONE,

    /** 이름이 {@code FAIL} 이 아니다 — 46 §8 의 표가 {@code FAILED} 로 확정했다. */
    FAILED
}
