package com.aiagent.domain.batch;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import org.springframework.stereotype.Component;

/**
 * 스프링 컨텍스트에 있는 {@link BatchJob} 구현 전부 — screen/admin/system/batch/schedule/requirements.md.
 *
 * <p>그 절이 <i>"목록의 출처: <b>서버가 준다</b> — 스프링 컨텍스트에서 {@code BatchJob}
 * 구현을 모은다. <b>시드가 아니다</b>"</i> 라고 적은 자리다. 시드로 두면 배포마다
 * <b>구현과 목록이 어긋날</b> 수 있고, 어긋나면 화면이 <i>고를 수 있는데 실행되지 않는</i>
 * 빈을 보여준다.
 *
 * <p><b>비어 있는 것이 정상이다.</b> 템플릿에는 구현이 하나도 없다({@link BatchJob}) —
 * 그때 셀렉트가 비고, 그 비어 있음은 고장이 아니라 <i>아직 배치가 없다</i> 는 사실이다.
 *
 * <h2>{@code Map} 주입이 곧 빈 이름이다</h2>
 *
 * <p>스프링이 {@code Map<String, BatchJob>} 을 주입할 때 키가 <b>빈 이름</b>이고, 그것이
 * 정확히 {@code SYS_SCHEDULE_BATCH.BEAN_ID} 에 저장되는 값이다. 클래스명을 쓰거나 따로
 * 이름을 붙이는 규칙을 만들면 <b>두 이름 사이에 매핑이 하나 생긴다</b>.
 *
 * <p><b>정렬해서 준다.</b> 컨텍스트의 순서는 클래스패스 스캔 순서라 배포마다 달라질 수
 * 있고, 셀렉트의 후보 순서가 흔들리면 <i>어제 셋째였던 것</i> 을 찾는 사람이 헤맨다.
 */
@Component
public class BatchJobRegistry {

    private final Map<String, BatchJob> jobs;

    public BatchJobRegistry(Map<String, BatchJob> jobs) {
        // TreeMap 이 정렬을 갖는다 — 아래 두 메서드가 같은 순서를 본다.
        this.jobs = new TreeMap<>(jobs);
    }

    /** 셀렉트의 후보 — {@code BEAN_ID} 그대로다(라벨을 지어내지 않는다). */
    public List<String> beanIds() {
        return new ArrayList<>(jobs.keySet());
    }

    /**
     * 저장이 이것으로 <b>없는 빈을 막는다</b>(screen/admin/system/batch/schedule/requirements.md — 원칙 P1).
     *
     * <p>화면은 고르게 해서 그 경로를 닫지만, 화면 밖 경로(직접 UPDATE · API 조작)는
     * 그 셀렉트를 지나지 않는다. 막지 않으면 <b>실행 시점에 터지고</b>, 그때는 크론이
     * 깨운 새벽이라 아무도 보지 않는다.
     */
    public boolean exists(String beanId) {
        return beanId != null && jobs.containsKey(beanId);
    }

    /**
     * 실행할 구현 — <b>없으면 비어 있다</b>.
     *
     * <p>저장이 막았으므로 여기서 비는 일은 <i>등록 뒤에 구현이 사라진 배포</i> 뿐이다.
     * 그것은 실제로 일어나며(리팩터링으로 빈 이름이 바뀐다) 그때 러너가 {@code FAIL} 로
     * 이력을 남긴다 — 조용히 건너뛰면 <i>안 도는데 이유가 없는</i> 상태가 된다.
     */
    public Optional<BatchJob> find(String beanId) {
        return Optional.ofNullable(jobs.get(beanId));
    }
}
