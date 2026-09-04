package com.ordinary.backoffice.domain.authz.entity;

import com.ordinary.backoffice.core.domain.BaseAuditEntity;
import com.ordinary.backoffice.domain.authz.ActionType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * API 마스터 — 42 §5 · ADR-0016.
 *
 * <p><b>{@code ACTION_CD} 는 이 API 의 속성이지 (API, 메뉴) 조합의 속성이 아니다.</b>
 * 여기 한 번만 존재하므로 <i>같은 API 가 메뉴 A 에서는 READ, 메뉴 B 에서는 SAVE</i> 라는
 * 모순이 <b>구조적으로 저장될 수 없다</b> — 검증을 사람의 리뷰에서 구조로 옮긴 것이다.
 *
 * <p><b>{@code HTTP_METHOD} 가 없다.</b> 업무 API 는 경로가 곧 오퍼레이션이라 메서드가 식별에
 * 기여하지 않고, 검증하지 않는 정보 컬럼은 표류한다. 한 경로에 두 오퍼레이션을 두려는 시도는
 * <b>PK 충돌로 시드 배포에서 막힌다</b>.
 *
 * <p><b>{@code USE_YN} 도 없다.</b> API 의 존재는 코드가 결정하는 사실이며 데이터로 끄는
 * 대상이 아니다 — 메뉴·역할의 {@code USE_YN} 과 축이 다르다.
 */
@Entity
@Table(name = "SYS_API")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysApi extends BaseAuditEntity {

    /** 고정 문자열이다 — 경로 변수·와일드카드가 없으므로 매칭이 해시 한 번이다(security-design.md §4). */
    @Id
    @Column(name = "API_URL", length = 200, nullable = false)
    private String apiUrl;

    /** {@code @Operation.summary} 에서 온다 — 없으면 시드를 만들 수 없어 빌드가 막는다. */
    @Column(name = "API_NM", length = 100, nullable = false)
    private String apiNm;

    @Column(name = "API_DESC", length = 500)
    private String apiDesc;

    @Enumerated(EnumType.STRING)
    @Column(name = "ACTION_CD", length = 20, nullable = false)
    private ActionType actionCd;
}
