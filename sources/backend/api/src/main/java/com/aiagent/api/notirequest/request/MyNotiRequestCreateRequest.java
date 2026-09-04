package com.aiagent.api.notirequest.request;

import com.aiagent.domain.notification.ReqType;
import com.aiagent.domain.notification.entity.SysNotiRequest;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 새 요청의 입력 — NOTI-06 사용자 측(screen/_standalone/README.md).
 *
 * <p><b>둘뿐이다.</b> 유형과 내용이며 나머지는 전부 서버가 정한다 — 요청자는 세션,
 * 상태는 {@code RECEIVED}, 시각은 주입받은 {@code Clock}(backend/persistence.md).
 *
 * <p><b>상태를 받지 않는 것이 요점</b>이다. 받으면 스스로 {@code DONE} 인 요청을 만들 수
 * 있고, 그것은 요청함을 <b>기록으로만</b> 쓰이게 한다.
 *
 * @param reqTypeCd 셋 중 하나 — 권한 신청 · 잠금 해제 · 기타(sys/notification.md). <b>공통코드가
 * 아니다</b>(screen/notice/requirements.md): 값이 늘면 처리 코드가 함께 늘어야 한다
 * @param reqContent <b>필수</b>다. 유형만으로는 무엇을 원하는지 알 수 없고, 그것을 되묻는
 * 단계가 없다(워크플로를 만들지 않는다)
 */
public record MyNotiRequestCreateRequest(
        @NotNull ReqType reqTypeCd,
        @NotBlank @Size(max = SysNotiRequest.REQ_CONTENT_MAX) String reqContent) {}
