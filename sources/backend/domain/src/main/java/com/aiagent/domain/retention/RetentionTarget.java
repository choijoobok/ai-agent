package com.aiagent.domain.retention;

import com.aiagent.support.config.props.RetentionProps;
import java.time.Instant;
import java.util.List;
import java.util.function.BiFunction;
import java.util.function.Consumer;
import java.util.function.Function;
import org.springframework.data.domain.Pageable;

/**
 * 파기 대상 하나 — retention.md 정책 표의 <b>한 행</b>이다.
 *
 * <p>retention.md 이 <i>"배치는 이 표를 데이터로 읽는다. 대상 테이블·기간을 코드에 하드코딩하지
 * 않는다"</i> 고 했다. 그 요구를 <b>레코드 넷</b>으로 만족시킨다 — 대상이 늘면 목록에 한 줄이
 * 늘고 배치 본문은 그대로다.
 *
 * <p><b>기간이 값이 아니라 함수인 것</b>이 요점이다. {@link RetentionProps} 는 실행마다
 * 스냅샷으로 새로 읽히므로(sys/config.md), 여기 숫자를 박아 두면 <b>기동 시점의 값에 굳는다</b> —
 * 화면에서 고쳐도 재기동 전까지 반영되지 않는다.
 *
 * <p><b>{@code direction} 이 없다.</b> retention.md 의 구조적 제외이며, 하한 대상은 이 목록에
 * 행 자체가 없다 — 설정으로도, 코드의 분기로도 켤 수 없다. 개인정보 접근 이력의 파기는
 * <b>별도 승인을 거친 수동 작업</b>이다.
 *
 * @param label 사람이 읽는 이름 — 실행 이력의 요약에 그대로 들어간다
 * @param table 테이블명 — 상세에만 쓴다. 요약은 사람 이름을 쓰고 상세는 대조할 수 있어야 한다
 * @param days 보존 일수를 <b>그때 읽는다</b>
 * @param findIds 대상 번호 한 청크 — <b>엔티티가 아니라 번호</b>다(nclob 을 읽지 않는다)
 * @param deleteByIds 그 번호들을 지운다 — {@code deleteAllByIdInBatch} 라 IN 절 하나다
 */
public record RetentionTarget(
        String label,
        String table,
        Function<RetentionProps, Integer> days,
        BiFunction<Instant, Pageable, List<Long>> findIds,
        Consumer<List<Long>> deleteByIds) {}
