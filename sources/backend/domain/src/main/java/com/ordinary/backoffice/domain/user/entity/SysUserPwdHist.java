package com.ordinary.backoffice.domain.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;

/**
 * 비밀번호 이력 — 41 §5. AUTH-05 의 <b>재사용 금지</b>가 이 테이블의 유일한 존재 이유다.
 *
 * <p><b>{@code USER_ID} 는 주체, {@code REG_ID} 는 행위자다.</b> 둘이 갈리는 유일한
 * 테이블이며(40 §3), 본인 변경이면 같고 관리자 임시 발급이면 다르다 — 그 구분이 여기 말고는
 * 남지 않는다(security-design.md §4).
 *
 * <p><b>{@link com.ordinary.backoffice.core.domain.BaseAuditEntity} 를 상속하지 않는다.</b>
 * 감사 컬럼이 {@code REG_*} 둘뿐이기 때문이다 — 이력은 수정되지 않으므로 {@code MOD_*} 는
 * 언제나 NULL 이고, 항상 NULL 인 컬럼이 늘면 그 컬럼 자체를 신뢰할 수 없게 된다(40 §4.2).
 *
 * <p><b>{@code CHG_SEQ} 는 사용자 안에서만 단조 증가한다.</b> 전역 시퀀스를 쓰지 않는 이유는
 * 비교가 언제나 <i>"이 사람의 최근 N건"</i> 이라 전역 번호에 쓸 데가 없기 때문이다.
 * 동시 변경은 PK 충돌로 드러난다 — 자기 비밀번호를 두 창에서 동시에 바꾸는 일은
 * 재시도로 충분하며, 조용히 덮어쓰는 것보다 낫다.
 */
@Entity
@Table(name = "SYS_USER_PWD_HIST")
@IdClass(SysUserPwdHistId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysUserPwdHist {

    @Id
    @Column(name = "USER_ID", length = 30, nullable = false)
    private String userId;

    @Id
    @Column(name = "CHG_SEQ", nullable = false)
    private Integer chgSeq;

    /** 과거 해시. {@code SYS_USER.PWD} 에서 그대로 옮겨 온 값이다 — 여기서 다시 해시하지 않는다. */
    @Column(name = "PWD", length = 100, nullable = false)
    private String pwd;

    @CreatedBy
    @Column(name = "REG_ID", length = 50, updatable = false)
    private String regId;

    @CreatedDate
    @Column(name = "REG_DTM", updatable = false)
    private Instant regDtm;

    @Builder
    private SysUserPwdHist(String userId, Integer chgSeq, String pwd) {
        this.userId = userId;
        this.chgSeq = chgSeq;
        this.pwd = pwd;
    }
}
