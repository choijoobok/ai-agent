package com.aiagent.domain.message.entity;

import com.aiagent.core.domain.BaseAuditEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 메시지 값 — <b>사람이 소유한다</b>. 시드가 이 테이블을 열지 않는다(sys/message.md).
 *
 * <p><b>행 지향이다</b>({@code MSG_KEY}, {@code LANG_CD}). 언어를 늘려도 DDL 이 바뀌지 않고,
 * 미번역 탐지(MASTER-06)가 조회 한 번이 된다 — 열 지향이면 언어마다 4벤더 changelog 를
 * 건드린다(sys/code.md).
 *
 * <p><b>{@code MSG_VAL} 이 NULL 일 수 있다.</b> 미번역이 <i>"행이 없다"</i> 가 아니라
 * <i>"값이 비었다"</i> 여야 관리 화면이 빈 셀을 그대로 편집한다. 빈 문자열과 가르며, 화면은
 * 빈 값을 NULL 로 저장한다 — 둘을 다 허용하면 폴백이 어느 쪽에서 도는지 알 수 없다(sys/code.md).
 */
@Entity
@Table(name = "SYS_MESSAGE")
@IdClass(SysMessageId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysMessage extends BaseAuditEntity {

    @Id
    @Column(name = "MSG_KEY", length = 200, nullable = false)
    private String msgKey;

    /** 지원 언어 목록의 원본은 공통코드({@code LANG_CD} 그룹)다 — 여기 하드코딩하지 않는다. */
    @Id
    @Column(name = "LANG_CD", length = 10, nullable = false)
    private String langCd;

    @Column(name = "MSG_VAL", length = 2000)
    private String msgVal;

    public static SysMessage of(String msgKey, String langCd, String msgVal) {
        SysMessage entity = new SysMessage();
        entity.msgKey = msgKey;
        entity.langCd = langCd;
        entity.msgVal = msgVal;
        return entity;
    }

    /**
     * <b>부르는 쪽이 {@code null} 을 넘기지 않는다.</b> 값을 비우는 것은 수정이 아니라
     * <b>행 삭제</b>이며(screen/code/requirements.md) 그 판단은 저장 서비스가 한다 — 여기서 {@code null} 을
     * 받아 주면 {@code MSG_VAL IS NULL} 인 행이 남아 폴백이 세 번째 상태를 갖는다.
     */
    public void changeValue(String msgVal) {
        this.msgVal = java.util.Objects.requireNonNull(msgVal, "msgVal");
    }
}
