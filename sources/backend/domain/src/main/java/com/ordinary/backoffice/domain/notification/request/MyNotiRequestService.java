package com.ordinary.backoffice.domain.notification.request;

import com.ordinary.backoffice.core.error.BusinessException;
import com.ordinary.backoffice.domain.notification.ReqStatus;
import com.ordinary.backoffice.domain.notification.ReqType;
import com.ordinary.backoffice.domain.notification.entity.SysNotiRequest;
import com.ordinary.backoffice.domain.notification.repository.SysNotiRequestRepository;
import com.ordinary.backoffice.support.config.ConfigLookup;
import com.ordinary.backoffice.support.config.props.NotiProps;
import java.time.Clock;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 요청을 <b>내는 쪽</b> — 알림 모달의 <i>내 요청</i> 탭(60 §8 · NOTI-06 사용자 측).
 *
 * <p>{@link NotiRequestService} 와 <b>같은 테이블의 반대편</b>이다. 나눈 이유는
 * 인가의 자리가 다르기 때문이다 — 저쪽은 {@code (NOTI_REQUEST, SAVE)} 권한이 필요한
 * {@code service} 계층이고, 여기는 <b>권한이 없는 사람도 부른다</b>({@code common} 계층 ·
 * security-design.md §4). 실제로 <b>권한이 없어서</b> 요청을 내는 것이 이 기능의 첫 용도다(권한 신청).
 *
 * <h2>대상이 언제나 세션의 주인이다</h2>
 *
 * <p>{@code userId} 를 인자로 받지만 컨트롤러가 {@code Principal} 에서 꺼내 넣는다 —
 * 요청 본문에 담지 않는 것이 요점이다. 담으면 <b>남의 이름으로 요청을 내는 경로</b>가
 * 열리고, 그 요청이 반려되면 <b>영문 모를 알림</b>이 그 사람에게 간다.
 *
 * <h2>낸 사람에게 알림을 넣지 않는다</h2>
 *
 * <p>main-shell.md §7.1 이 <i>"상태가 바뀌면 그것이 내 알림으로 온다"</i> 고 하며 <b>접수</b>를 함께
 * 적었지만, 접수는 <b>내가 방금 한 일</b>이다 — 알림이 답하는 물음은 <i>"내가 하지 않은
 * 무슨 일이 있었나"</i> 이고, 내 행동을 나에게 알리면 <b>배지가 내 클릭을 세게</b> 된다.
 * 접수 사실은 <i>내 요청</i> 탭에 그 줄이 생기는 것으로 이미 보인다.
 *
 * <h2>관리자에게도 알리지 않는다</h2>
 *
 * <p>66 §6.2 의 생산자 넷에 <i>요청 접수</i> 가 없다. 대기열은 {@code NOTI_REQUEST} 화면이
 * 보는 것이고, 알림으로도 보내면 <b>같은 사실을 두 곳이 말한다</b> — 그리고 받을 사람을
 * 정하려면 <i>어느 역할이 요청을 처리하는가</i> 라는 설정이 하나 더 필요해진다.
 */
@Service
@Transactional(readOnly = true)
public class MyNotiRequestService {

    private final SysNotiRequestRepository requests;
    private final ConfigLookup configs;
    private final Clock clock;

    public MyNotiRequestService(
            SysNotiRequestRepository requests, ConfigLookup configs, Clock clock) {
        this.requests = requests;
        this.configs = configs;
        this.clock = clock;
    }

    /** 내가 낸 것 — <b>최신이 위</b>다(대기열이 아니라 이력이다 · 66 §5.2.1). */
    public MyRequests findMine(String userId) {
        int limit = configs.get(NotiProps.class).listSize();

        List<MyRequestRow> rows =
                requests.findByUserIdOrderByCreDtmDescReqIdDesc(userId, PageRequest.ofSize(limit))
                        .stream()
                        .map(MyNotiRequestService::rowOf)
                        .toList();

        return new MyRequests(rows, requests.countByUserId(userId));
    }

    /**
     * 새 요청 — <b>같은 유형이 접수 상태로 열려 있으면 거부한다</b>.
     *
     * <p>워크플로가 없으므로(01 §2) 요청은 한 번 내면 답이 올 때까지 그대로다. 여벌을
     * 허용하면 두 가지가 생긴다 — 대기열이 <b>같은 사람의 같은 말</b>로 차고, 관리자가
     * 그 여벌을 하나씩 반려하는 동안 <b>반려 알림이 그 수만큼 나간다</b>(66 §5.4).
     * 더블클릭 한 번이 그것을 만든다.
     *
     * <p><b>유형별로 센다.</b> 권한 신청과 잠금 해제는 서로 다른 답을 기다리는 것이라
     * 함께 열려 있어야 한다. {@link ReqType#ETC} 도 하나로 묶이는데, 그것이 기타의 값이다 —
     * 여러 건을 동시에 열어야 할 만큼 잦으면 <b>유형이 되어야 한다</b>.
     *
     * @return 만들어진 요청 번호
     */
    @Transactional
    public Long create(String userId, ReqType reqTypeCd, String reqContent) {
        if (reqContent == null || reqContent.isBlank()) {
            throw new BusinessException(
                    NotiRequestErrorCode.CONTENT_REQUIRED, "요청 내용이 비었다");
        }
        if (requests.existsByUserIdAndReqTypeCdAndReqStatCd(
                userId, reqTypeCd, ReqStatus.RECEIVED)) {
            throw new BusinessException(
                    NotiRequestErrorCode.DUPLICATE,
                    "접수 상태의 같은 유형이 있다 — " + userId + " · " + reqTypeCd);
        }

        SysNotiRequest saved = requests.save(SysNotiRequest.builder()
                .userId(userId)
                .reqTypeCd(reqTypeCd)
                .reqContent(reqContent)
                .creDtm(clock.instant())
                .build());
        return saved.getReqId();
    }

    private static MyRequestRow rowOf(SysNotiRequest request) {
        return new MyRequestRow(
                request.getReqId(),
                request.getCreDtm(),
                request.getReqTypeCd(),
                request.getReqContent(),
                request.getReqStatCd(),
                request.getHandleDtm(),
                request.getHandleMemo());
    }
}
