package com.aiagent.domain.progress;

import java.util.Optional;

/**
 * 진행 상태가 사는 곳 — backend/crosscutting.md.
 *
 * <p><b>인터페이스인 것이 backend/crosscutting.md 의 요구다</b>: 배포 형태에 따라 저장소가 갈린다
 * ({@code jdbc} · {@code redis} · {@code caffeine} · {@code inmemory}). <b>지금 서 있는
 * 것은 {@code jdbc} 하나</b>이며(구현된 것만 담는다) 그것이 템플릿의 기본 가정이기
 * 때문이다 — <i>다중화이면서 Redis 가 없는 배포</i>.
 *
 * <p><b>나머지를 미리 만들지 않는 이유</b>는 그 셋이 전부 <b>노드 로컬</b>이라, 폴링이
 * 작업을 실행한 노드가 아닌 곳으로 가면 <b>조용히 못 찾기</b> 때문이다(backend/crosscutting.md — backend/crosscutting.md 와
 * 같은 함정). 골라 쓸 수 있게 두면 <i>단일 인스턴스에서 잘 돌던 것</i>이 배포에서 깨지고,
 * 그 고장은 <b>가끔 못 찾는다</b> 로만 보인다.
 */
public interface JobProgressStore {

    /** {@code RUNNING} 사전 등록 — 첫 폴링이 <i>없음</i> 을 받지 않게 한다(backend/crosscutting.md). */
    void start(String jobId, String userId, Long totCnt);

    /**
     * 진행 — 호출한 쪽이 flush 시점을 정한다({@link Progress} 가 그것을 조절한다).
     *
     * @param stepMsg {@code null} 이면 <b>앞의 문구가 남는다</b>
     * @param subTitle 〃 소제목. 대개 {@code null} 이다 — 소제목은 구간이 바뀔 때만 바뀐다
     */
    void progress(String jobId, long curCnt, String stepMsg, String subTitle);

    /**
     * <b>다음 구간</b> — 소제목을 바꾸고 건수를 0 으로, 전체를 {@code totCnt} 로 되돌린다.
     *
     * <p><b>즉시 쓴다.</b> 조절({@link Progress})의 대상이 아닌 것은 이것이 진행이 아니라
     * <b>구간의 경계</b>이기 때문이다 — 늦으면 그 사이의 폴링이 <i>새 구간의 건수 대 앞
     * 구간의 전체</i> 를 보고, 화면은 <b>100% 를 넘긴 막대</b>를 그린다.
     */
    void reset(String jobId, String subTitle, Long totCnt);

    /** 종료는 <b>즉시 쓴다</b> — 늦으면 끝난 작업이 99% 에서 멈춰 보인다(backend/crosscutting.md). */
    void complete(String jobId);

    /** 〃 실패. */
    void fail(String jobId, String errMsg);

    /**
     * 그 사람의 것만 — <b>다른 사람의 {@code jobId} 는 없는 것</b>이다(sys/batch.md).
     *
     * <p>가르지 않고 돌려주면 <i>존재는 한다</i> 가 새어 나가는데, 진행률 문구에는
     * 업무 데이터가 섞이므로(<i>"주문 A-1023 처리 중"</i>) 그것은 진행률이 아니라
     * <b>업무 정보의 노출</b>이다.
     */
    Optional<JobProgressView> find(String jobId, String userId);
}
