package com.aiagent.domain.config.entity;

import com.aiagent.core.domain.BaseAuditEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 시스템 환경설정의 <b>오버라이드</b> — sys/code.md · screen/code/requirements.md.
 *
 * <p><b>행이 없는 키가 정상이다.</b> 층이 둘이라({@code yml} 이 기본값, 여기가 적용값) 한
 * 번도 바꾸지 않은 키는 이 테이블에 없다 — 그 비어 있음은 <i>"값이 없다"</i> 가 아니라
 * <b><i>"아무도 안 바꿨다"</i></b> 를 뜻한다.
 *
 * <p><b>행의 존재가 곧 {@code 변경됨} 이다.</b> 값이 기본값과 같아도 행이 있으면 배지가
 * 붙는다(screen/code/requirements.md) — 같은 값으로 저장해 두면 <b>다음 배포가 {@code yml} 기본값을 올려도 그
 * 키만 옛 값에 묶이기</b> 때문이며, 두 값이 같아 눈으로는 구분되지 않으므로 <b>배지가
 * 유일한 신호</b>다.
 *
 * <p><b>컬럼이 셋 없다</b> — {@code CFG_TYPE_CD}(필드 타입) · {@code CFG_DESC}(필드 Javadoc) ·
 * {@code SYS_YN}(두 층 폴백이라 지킬 것이 없다). 원천이 전부 코드로 옮겨갔고, DB 에 두면
 * 같은 사실이 두 곳이 된다(sys/code.md).
 *
 * <p><b>쓰기 경로는 관리 화면 하나다</b> — SQL 직접 수정은 비지원이며 잘못된 값은 다음
 * 재바인딩에서 예외로 죽는다(sys/config.md).
 */
@Entity
@Table(name = "SYS_CONFIG")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SysConfig extends BaseAuditEntity {

    /** {@code yml} 프로퍼티 경로에서 루트 {@code sys-config.} 만 뺀 것 — sys/code.md. */
    @Id
    @Column(name = "CFG_KEY", length = 100, nullable = false)
    private String cfgKey;

    /**
     * 문자열로 보관한다 — 타입은 필드가 갖는다.
     *
     * <p><b>{@code null} 이 아니다.</b> 값을 비우는 것은 수정이 아니라 <b>되돌리기(행 삭제)</b>
     * 이며(screen/code/requirements.md), {@code null} 을 허용하면 <i>"행은 있는데 값이 없다"</i> 는 세 번째 상태가
     * 생겨 오버라이드가 무엇을 뜻하는지 다시 물어야 한다.
     */
    @Column(name = "CFG_VAL", length = 1000, nullable = false)
    private String cfgVal;

    public static SysConfig of(String cfgKey, String cfgVal) {
        SysConfig entity = new SysConfig();
        entity.cfgKey = cfgKey;
        entity.cfgVal = cfgVal;
        return entity;
    }

    public void changeValue(String cfgVal) {
        this.cfgVal = java.util.Objects.requireNonNull(cfgVal, "cfgVal");
    }
}
