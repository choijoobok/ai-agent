package com.ordinary.backoffice.domain.authz.entity;

import com.ordinary.backoffice.core.domain.BaseAuditEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 메뉴 ↔ API 매핑 — 42 §5.
 *
 * <p><b>이 행의 추가가 곧 접근 범위 확장이다.</b> 그래서 운영 화면에서 편집하는 데이터가
 * 아니라 화면 코드와 함께 <b>코드 리뷰를 거쳐 배포되는 시드</b>다(security-design.md §4 · ADR-0020).
 *
 * <p>1 : N 이 정상이다 — 같은 API 를 여러 화면이 쓴다. 판정은 그 메뉴들 중 <b>하나라도</b>
 * 권한이 있으면 통과하는 OR 이며, 그것이 정당한 이유는 <b>사용자가 얻는 것이 화면이 아니라
 * API 능력</b>이고 능력은 호출 경로와 무관하기 때문이다. 화면마다 허용 <b>범위</b>가 달라야
 * 한다면 그것은 공유 API 가 아니라 <b>분리해야 할 두 API</b> 다.
 *
 * <p><b>0건은 아무도 권한을 가질 수 없다는 뜻이다.</b> {@code SYS_API} 에 행이 없는 것과
 * 구분해 기록한다 — 둘 다 403 이지만 고치는 곳이 다르다(security-design.md §4).
 */
@Entity
@Table(name = "SYS_MENU_API")
@IdClass(SysMenuApiId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysMenuApi extends BaseAuditEntity {

    @Id
    @Column(name = "MENU_CD", length = 30, nullable = false)
    private String menuCd;

    @Id
    @Column(name = "API_URL", length = 200, nullable = false)
    private String apiUrl;
}
