package com.aiagent.api.authz;

import com.aiagent.domain.authz.ActionType;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 경로 접두를 이기는 액션 선언 — backend/api.md 결정 1.
 *
 * <p>업무 API 의 액션은 <b>경로 접두가 정한다</b>({@code get·search·find·retrieve} → {@code READ},
 * {@code save·insert·update·delete} → {@code SAVE}, {@code export} → {@code EXPORT}, 그 밖은
 * {@code EXECUTE}). 이것은 <b>규약을 지킬 수 없는 경로를 위한 예외</b>다 — 레거시 이관처럼
 * 경로를 바꿀 수 없는 경우와, 접두가 실제 동작과 어긋나는 경우.
 *
 * <p><b>런타임 판정에 참여하지 않는다.</b> {@code generateApiSeed} 의 입력일 뿐이며 판정
 * 원본은 여전히 {@code SYS_API} 데이터 하나다(backend/security.md) — 기동 시 애너테이션↔데이터 정합 검증도
 * 두지 않는다. 그래서 {@code RUNTIME} 유지인 것은 <b>바이트코드 스캔이 읽기 위해서</b>이지
 * 애플리케이션이 읽기 위해서가 아니다.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
public @interface ApiActionType {

    ActionType value();
}
