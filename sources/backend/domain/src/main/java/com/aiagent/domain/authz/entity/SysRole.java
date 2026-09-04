package com.aiagent.domain.authz.entity;

import com.aiagent.core.domain.BaseAuditEntity;
import com.aiagent.core.domain.YnConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 역할 — 42 §3.
 *
 * <p><b>역할 자체에는 유효 기간이 없다.</b> 역할은 조직의 구조물이며 "언제부터 언제까지
 * 존재하는 역할" 이라는 개념이 없다. 기간은 <b>부여</b>({@link SysUserRole})의 것이다.
 *
 * <p><b>{@code SORT_NO} 를 두지 않는다</b>(42 §3). 소비처가 역할 관리 화면의 정렬 하나였는데
 * 그 그리드는 헤더 정렬을 이미 갖는다. 남는 것은 숫자를 손으로 매기는 일뿐이고,
 * <b>컬럼이 있으면 우선순위로 읽힌다</b> — 합집합에 우선순위는 없다.
 */
@Entity
@Table(name = "SYS_ROLE")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysRole extends BaseAuditEntity {

    @Id
    @Column(name = "ROLE_ID", length = 30, nullable = false)
    private String roleId;

    @Column(name = "ROLE_NM", length = 100, nullable = false)
    private String roleNm;

    @Column(name = "ROLE_DESC", length = 500)
    private String roleDesc;

    /**
     * 유효 권한 계산의 <b>입력 필터</b> — security-design.md §4.
     *
     * <p>{@code 'N'} 인 역할은 권한 행을 <b>내지 않는다</b>. 플래그를 OR 하는 것이 아니다 —
     * "하나라도 Y 면 전부 유효" 로 읽으면 <b>역할 비활성화가 무의미해진다</b>.
     */
    @Convert(converter = YnConverter.class)
    @Column(name = "USE_YN", length = 1, nullable = false)
    private Boolean useYn;

    /**
     * 관리 화면이 만드는 역할 — 62 §3.7. <b>받는 것이 넷이다.</b>
     *
     * <p>{@code ROLE_ID} 는 PK 이고 <b>등록 후 수정 불가</b>다(41 §3) — 고치려면 지우고 다시
     * 만든다. 그래서 여기서만 값이 정해진다.
     *
     * <p><b>{@code SORT_NO} 를 받지 않는다.</b> 컬럼 자체가 없다(42 §3) — 역할의 <i>자연스러운
     * 순서</i> 는 권한 범위 순이며 그것이 정확히 security-design.md §4 가 금지한 오해다.
     */
    public static SysRole created(String roleId, String roleNm, String roleDesc, boolean useYn) {
        SysRole role = new SysRole();
        role.roleId = roleId;
        role.roleNm = roleNm;
        role.roleDesc = roleDesc;
        role.useYn = useYn;
        return role;
    }

    /**
     * 이름 · 설명 · 사용 여부를 함께 쓴다 — 그리드 한 행이 한 번에 저장되기 때문이다(grid-standard.md §3.1).
     *
     * <p><b>{@code USE_YN} 을 따로 열지 않는다.</b> 끄는 것은 보유자 전원의 유효 권한을 바꾸는
     * 조작이지만(security-design.md §4) 그 경고는 <b>화면이 저장 전에</b> 내고(62 §3.6), 세션 무효화는
     * <b>저장 서비스가</b> 한다 — 엔티티가 자기 행 밖의 일을 알 이유가 없다.
     */
    public void apply(String roleNm, String roleDesc, boolean useYn) {
        this.roleNm = roleNm;
        this.roleDesc = roleDesc;
        this.useYn = useYn;
    }
}
