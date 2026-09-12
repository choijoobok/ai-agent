package com.aiagent.domain.code.entity;

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
 * 코드 그룹 — sys/code.md · screen/admin/system/code/requirements.md.
 *
 * <p><b>{@code GRP_NM} 이 메시지 키가 아니다.</b> sys/code.md 이 표시 명칭의 단일 원본을
 * {@code SYS_MESSAGE} 로 정하면서 <b>관리 화면 전용 명칭</b>을 예외로 뒀고, 이 값은
 * {@code CODE_MGMT} 안에서만 보인다 — 운영자 화면까지 다국어로 열면 메시지 행이 관리 대상
 * 데이터보다 많아진다. {@link SysCode#getDtlNm()} 이 그 반대편이다.
 *
 * <p><b>{@code SYS_YN} 에 변경 메서드가 없다.</b> <i>"이 그룹을 소스가 문자열로 참조하는가"</i>
 * 는 코드가 아는 사실이지 운영 데이터가 아니므로(sys/code.md) 시드 말고는 쓰는 경로를 두지
 * 않는다. 화면이 입력 수단을 없애는 것(screen/admin/system/code/requirements.md)과 <b>같은 방향으로 두 번</b> 막는 것이며,
 * 화면만 막으면 요청 본문으로 뚫린다(원칙 P1).
 *
 * <h2>{@code USE_YN} 이 없다 — sys/code.md (2026-08-30 개정)</h2>
 *
 * {@link SysCode} 에는 있고 여기에는 없다. <b>이름이 같다고 같은 것이 아니다.</b>
 *
 * <table>
 *   <tr><td>{@code SysCode.USE_YN}</td>
 * <td>읽는 쪽이 있다 — <b>콤보 후보에서 뺀다</b>(sys/code.md). 이미 저장된 데이터는
 *           그 값을 갖고 있으므로 <b>이름 조회는 계속 된다</b>: <i>"새로 고르지는 못하지만
 *           옛 행은 여전히 읽힌다"</i> 가 그 플래그의 뜻이다</td></tr>
 *   <tr><td>{@code SysCodeGroup.USE_YN}</td>
 *       <td><b>읽는 쪽이 없었다.</b> 그룹은 콤보의 후보가 아니라 <b>소스가 이름으로 지목하는
 *           것</b>이라(JPQL·네이티브 쿼리·프론트 상수 어디에나 문자열로 박힌다) 끄면 무슨
 *           일이 일어나야 하는지 답이 없다 — 콤보가 통째로 비면 화면이 못 쓰고, 무시하면
 *           플래그가 아무 일도 안 한다</td></tr>
 * </table>
 *
 * <p><b>그래서 지우는 쪽을 골랐다.</b> 안 쓰는 그룹은 <b>지우거나 그냥 두면</b> 된다 —
 * 목록에 남아 있는 비용은 낮고, 코드가 남아 있으면 삭제 게이트가 막는데 그것은 <i>"정말 안
 * 쓰면 코드도 지워라"</i> 로 읽혀 자연스럽다.
 *
 * <p><b>{@code SYS_YN} 은 왜 남는가</b> — 자동 검출을 표방하지 않기 때문이다. 시드가
 * <b>선언</b>하고 저장 서비스가 <b>읽는다</b>(삭제 거부). 무엇을 보호하는지도 그 선언이
 * 말한다. 없앤 쪽은 <i>선언도 소비자도 없이 화면에 스위치만 있던 것</i>이다.
 */
@Entity
@Table(name = "SYS_CODE_GROUP")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysCodeGroup extends BaseAuditEntity {

    @Id
    @Column(name = "GRP_CD", length = 30, nullable = false)
    private String grpCd;

    @Column(name = "GRP_NM", length = 100, nullable = false)
    private String grpNm;

    @Column(name = "GRP_DESC", length = 500)
    private String grpDesc;

    @Convert(converter = YnConverter.class)
    @Column(name = "SYS_YN", length = 1, nullable = false)
    private Boolean sysYn;

    /** 관리 화면 정렬이다 — 콤보 정렬은 {@link SysCode} 쪽이다(screen/admin/system/code/requirements.md). */
    @Column(name = "SORT_NO", nullable = false)
    private Integer sortNo;

    /** 화면이 만드는 그룹은 언제나 {@code SYS_YN = 'N'} 이다 — 인자로 열어 두지 않는다. */
    public static SysCodeGroup created(String grpCd, String grpNm, String grpDesc, Integer sortNo) {
        SysCodeGroup entity = new SysCodeGroup();
        entity.grpCd = grpCd;
        entity.sysYn = false;
        entity.apply(grpNm, grpDesc, sortNo);
        return entity;
    }

    /**
     * 고칠 수 있는 셋 — {@code GRP_CD} 와 {@code SYS_YN} 은 여기 없다.
     *
     * <p>앞엣것은 PK 라 바뀌면 다른 행이고, 뒤엣것은 위 클래스 주석의 이유다.
     */
    public void apply(String grpNm, String grpDesc, Integer sortNo) {
        this.grpNm = grpNm;
        this.grpDesc = grpDesc;
        this.sortNo = sortNo;
    }
}
