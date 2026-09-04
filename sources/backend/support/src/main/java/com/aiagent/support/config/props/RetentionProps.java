package com.aiagent.support.config.props;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * 이력 보존 기간 — retention.md 의 정책 표가 <b>여기서 값이 된다</b>(LOG-07).
 *
 * <h2>{@code app.retention.*} 이 아니라 {@code sys-config.retention.*} 이다</h2>
 *
 * <p>retention.md 이 스케치한 자리는 {@code app.} 아래였다. 그러면 <b>yml 뿐</b>이라 기간을 바꾸는
 * 데 재배포가 필요하다 — 그런데 보존 기간은 <i>운영하면서 조정하는 값</i>이고, 조정하는
 * 사람은 배포 권한이 없는 경우가 보통이다. {@code sys-config.} 아래에 두면 {@code
 * ConfigCatalog} 가 자동으로 주워 <b>시스템 환경설정 화면에 나타나고</b> {@code SYS_CONFIG}
 * 로 덮인다(sys/code.md · sys/config.md).
 *
 * <h2>중첩 맵이 아니라 <b>평평한 스칼라 다섯</b>이다</h2>
 *
 * <p>retention.md 은 {@code policies: { sys-lo-access: { direction: max, days: 90 } }} 로 그렸다.
 * 그 모양을 그대로 옮기면 화면이 그리지 못한다 — {@code ConfigValueType} 은 문자열·숫자·
 * 불리언·JSON 넷뿐이라(sys/code.md) 중첩 맵은 <b>JSON 덩어리 한 칸</b>이 되고, 그러면 기간
 * 하나를 고치려고 <b>JSON 을 손으로 편집</b>하게 된다. 검증도 함께 사라진다.
 *
 * <p><b>{@code direction} 이 없는 것</b>은 retention.md 가 <i>하한 대상은 설정으로 켤 수 있게도
 * 하지 않는다 — 구조적 제외</i> 라고 못박았기 때문이다. 설정에 두면 그 문장이 깨진다:
 * 개인정보 접근 이력의 파기가 <b>화면에서 한 칸 바꾸면 가능한 일</b>이 된다. 대상 다섯은
 * 코드가 갖고, 늘리려면 소스를 고쳐야 한다.
 *
 * @param accessLogDays 사용 이력({@code SYS_LO_ACCESS}). <b>가장 짧다</b> — 요청 전문이
 * {@code nclob} 이라 비대화가 가장 빠르다(retention.md)
 * @param exceptionLogDays 에러 로그({@code SYS_LO_EXCEPTION}). 양은 적고 수명은 길다.
 *     사용 이력보다 길어서 <b>180일 된 에러의 요청 전문은 이미 없다</b> — 받아들인 값이다
 * @param loginLogDays 로그인 이력({@code SYS_LO_LOGIN})
 * @param batchHistoryDays 배치 실행 이력({@code SYS_BATCH_HISTORY}). <b>파기 배치 자신의
 * 이력도 여기 걸린다</b> — 순환이 아니다(retention.md)
 * @param notiInboxDays 인앱 알림({@code SYS_NOTI_INBOX}). <b>읽음 여부를 보지 않는다</b> —
 * sys/notification.md 이 닫은 결정이며, 읽은 것만 지우면 <b>안 읽은 알림이 영원히 쌓이고</b> 그것이
 *     정확히 지우고 싶은 행이다(아무도 안 보는 알림). 이력이 아닌 첫 대상이다
 * @param chunkSize 한 트랜잭션에서 지우는 행 수. 90일분을 한 번에 지우면 <b>락과 언두 로그가
 * 터진다</b>(retention.md). 너무 작으면 왕복이 늘 뿐이라 천 단위가 무난하다
 */
@ConfigurationProperties(prefix = "sys-config.retention")
@Validated
public record RetentionProps(
        @NotNull @Min(1) Integer accessLogDays,
        @NotNull @Min(1) Integer exceptionLogDays,
        @NotNull @Min(1) Integer loginLogDays,
        @NotNull @Min(1) Integer batchHistoryDays,
        @NotNull @Min(1) Integer notiInboxDays,
        @NotNull @Min(100) @Max(100000) Integer chunkSize) {}
