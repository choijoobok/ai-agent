package com.aiagent.api.notirequest.request;

import com.aiagent.domain.notification.ReqStatus;
import com.aiagent.domain.notification.entity.SysNotiRequest;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 처리·반려의 입력 — screen/notice/requirements.md.
 *
 * <p><b>{@code SaveRow} 가 아니다.</b> 이 화면은 셀을 고치지 않으므로(screen/notice/requirements.md) 행 단위
 * 저장이 성립하지 않는다 — 입력은 <b>대상 목록 + 상태 + 메모</b> 셋뿐이며 그 셋이 곧
 * 하나의 판정이다.
 *
 * <p><b>{@code handlerId} 를 받지 않는다.</b> 처리자는 세션이 안다({@code AuditorAware}) —
 * 받으면 <i>남의 이름으로 처리한 것</i>을 만들 경로가 열린다(원칙 P1).
 *
 * <p><b>반려 사유의 필수 여부를 여기서 표현할 수 없다.</b> {@link ReqStatus} 에 따라
 * 갈리는 조건부 필수라 Bean Validation 으로는 <i>둘 다 선택</i> 밖에 못 적는다 —
 * 판정은 {@code NotiRequestService} 가 하며 그것이 셀 오류로 돌아온다(frontend/grid.md).
 *
 * @param targets <b>비어 있으면 400</b> 이다. 화면은 버튼을 비활성으로 막지만(frontend/grid.md)
 *     화면 밖 경로가 실재한다
 * @param reqStatCd {@link ReqStatus#DONE} 또는 {@link ReqStatus#REJECTED}.
 *     {@link ReqStatus#RECEIVED} 가 오면 서비스가 거부한다 — <b>되돌리는 전이가 없다</b>
 * (screen/notice/requirements.md)
 */
public record NotiRequestHandleRequest(
        @NotEmpty @Size(max = 1000) List<@NotNull Long> targets,
        @NotNull ReqStatus reqStatCd,
        @Size(max = SysNotiRequest.HANDLE_MEMO_MAX) String handleMemo) {}
