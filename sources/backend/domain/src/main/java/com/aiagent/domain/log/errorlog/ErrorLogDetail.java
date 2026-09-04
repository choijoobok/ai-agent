package com.aiagent.domain.log.errorlog;

/**
 * 상세 모달이 받는 것 — 64 §5.5. <b>탭 둘을 한 번에</b> 가져온다.
 *
 * <p><b>왕복이 하나인 이유.</b> 둘 다 {@code nclob} 이고, 스택을 보다가 전문을 보는 것이
 * <b>진단의 기본 동선</b>이다. 탭마다 부르면 왕복이 둘이 되고 <b>두 번째가 실패하면 절반만
 * 열린 모달</b>이 된다.
 *
 * <p><b>전문은 다른 테이블에서 온다.</b> {@code PARAMETERS} 는 사용 이력에만 있고(45 §4.2)
 * {@code TRACE_ID} 가 둘을 잇는다 — §1.4 가 배타를 없앤 대가를 이 레코드가 그대로 받는다.
 *
 * @param rootCauseStack {@code null} 이면 <b>4xx 라 저장하지 않은 것</b>이다(64 §5.3).
 *     화면은 스택 탭을 비활성으로 두고 <i>"이 오류는 스택을 남기지 않습니다"</i> 를 낸다
 * @param parametersFound 사용 이력에 그 요청이 <b>남아 있는가</b>. {@code false} 면
 *     <b>90일이 지나 파기된 것</b>이다(32 §3) — 보존이 180일 / 90일로 달라 <b>180일 된 오류의
 *     전문은 없다</b>. {@code parameters} 가 {@code null} 인 것과 <b>다른 사실</b>이며(전문
 *     없이 남은 정상 행이 있다 — 멀티파트 요청 · 캐싱이 꺼진 구간), 섞으면 그 정상 행이
 *     <i>파기됨</i> 으로 보인다
 */
public record ErrorLogDetail(
        Long exceptionLogSeq,
        String rootCauseStack,
        boolean stackTruncated,
        String parameters,
        boolean parametersFound,
        boolean parametersTruncated) {}
