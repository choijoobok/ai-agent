package com.ordinary.backoffice.domain.user.entity;

import com.ordinary.backoffice.core.domain.BaseAuditEntity;
import com.ordinary.backoffice.core.domain.YnConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.time.LocalDate;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 접속 IP 허용 — 41 §7 · AUTH-08. <b>행이 없으면 제한 없음이다.</b>
 *
 * <p>그 해석이 이 테이블의 전부다. 빈 화이트리스트를 전면 차단으로 읽으면 <b>운영 사고가
 * 관리자 계정에서</b> 난다 — 이 기능을 쓰는 계정이 정확히 그것이기 때문이다.
 *
 * <p><b>기간과 {@code USE_YN} 이 층이 다르다</b>(2026-08-31). 한동안 기간이 없었고 근거는
 * <i>"허용 대역은 사무실이 어디인가 라는 사실이고 그것은 예정된 종료를 갖지 않는다"</i> 였다 —
 * 그 문장이 용도를 하나로 봤다. 파견 · 출장 · 외부 감사처럼 <b>기한이 정해진 접근</b>이
 * 둘째 용도이며, 기간이 없으면 그 대역을 <b>사람이 기억해서</b> 지워야 하고 잊으면
 * <b>끝난 계약의 IP 가 열려 있는 상태</b>가 된다.
 *
 * <p>{@code USE_YN} 은 <i>지금 손으로 끄고 켜는 것</i>이고 기간은 <i>미리 정해 두는 것</i>이다 —
 * 둘의 AND 가 판정이며 {@link SysUserRole} 이 이미 같은 모양을 갖는다(42 §3.1). 그리고
 * {@code USE_YN} 은 여전히 <b>지우지 않고 끄는</b> 수단이다: 지웠다 다시 넣으면 감사
 * 4컬럼이 사라져 <i>누가 언제 이 대역을 열었나</i> 에 답할 수 없다.
 *
 * <p><b>이 행을 읽는 검사는 아직 없다</b>(2026-08-30). AUTH-08 은 S 등급이고 41 §4.2 가
 * 그 검사를 <b>로그인 후처리 핸들러 체인</b>의 한 클래스로 배정해 두었다 — 이 슬라이스가
 * 세우는 것은 <b>값을 관리하는 화면</b>이며(61 §3.8 탭 3), 집행은 그 핸들러가 설 때 붙는다.
 * 순서가 이쪽인 이유는 <b>검사가 먼저 서면 아무도 값을 넣을 수 없어 전원이 잠기기</b>
 * 때문이다.
 */
@Entity
@Table(name = "SYS_USER_IP_ALLOW")
@IdClass(SysUserIpAllowId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysUserIpAllow extends BaseAuditEntity {

    @Id
    @Column(name = "USER_ID", length = 30, nullable = false)
    private String userId;

    /**
     * 단일 IP 또는 CIDR — <b>PK 의 일부다.</b>
     *
     * <p>같은 사용자에게 같은 대역을 두 번 넣을 수 없다. 대리키를 두면 중복 행이 생기고,
     * 그때 하나만 끄면 나머지가 살아 있어 <i>"껐는데 들어와진다"</i> 가 된다.
     */
    @Id
    @Column(name = "IP_CIDR", length = 45, nullable = false)
    private String ipCidr;

    @Convert(converter = YnConverter.class)
    @Column(name = "USE_YN", length = 1, nullable = false)
    private Boolean useYn;

    /**
     * 허용 기간 — <b>양끝 포함이며 {@code null} 이 제한 없음</b>이다(40 §4.3).
     *
     * <p>{@code null} 을 그렇게 읽는 것이 <b>기간을 뒤늦게 더할 수 있었던 이유</b>다 —
     * 기간을 적지 않은 기존 행은 예전과 똑같이 동작한다.
     *
     * <p><b>{@code LocalDate} 다.</b> 시각까지 두면 <i>오늘 몇 시부터</i> 를 누가 정하느냐가
     * 브라우저의 시계로 흘러간다 — 판정 시각은 서버가 정한다({@code BusinessCalendar}).
     */
    @Column(name = "VALID_FROM_DT")
    private LocalDate validFromDt;

    @Column(name = "VALID_TO_DT")
    private LocalDate validToDt;

    public static SysUserIpAllow created(
            String userId, String ipCidr, boolean useYn, LocalDate validFromDt, LocalDate validToDt) {
        SysUserIpAllow allow = new SysUserIpAllow();
        allow.userId = userId;
        allow.ipCidr = ipCidr;
        allow.useYn = useYn;
        allow.validFromDt = validFromDt;
        allow.validToDt = validToDt;
        return allow;
    }

    /**
     * 고칠 수 있는 것은 <b>사용 여부와 기간</b>이다 — {@code IP_CIDR} 은 PK 라 못 고친다.
     *
     * <p>대역을 바꾸는 것은 지우고 다시 넣는 것이며, 그것이 맞다: 다른 대역은 다른 사실이지
     * 같은 사실의 수정이 아니다. <b>기간은 같은 사실의 수정</b>이다 — 파견이 연장되면 그
     * 대역은 그대로이고 끝나는 날만 바뀐다.
     */
    public void change(boolean useYn, LocalDate validFromDt, LocalDate validToDt) {
        this.useYn = useYn;
        this.validFromDt = validFromDt;
        this.validToDt = validToDt;
    }
}
