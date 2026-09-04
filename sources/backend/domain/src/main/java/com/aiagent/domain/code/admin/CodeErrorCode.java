package com.aiagent.domain.code.admin;

import com.aiagent.core.error.ErrorCode;
import com.aiagent.core.error.ErrorType;
import com.aiagent.core.message.MsgKey;

/**
 * {@code CODE_MGMT} 저장의 거부 — screen/code/requirements.md.
 *
 * <p><b>여덟 중 화면이 미리 막을 수 있는 것은 하나도 없다.</b> 현재 페이지 밖의 코드값과
 * 다른 사람의 삭제·추가는 화면이 모르고, {@code SYS_YN} 과 참조 코드 화이트리스트는 서버가
 * 갖는다 — frontend/grid.md 의 <i>"프론트 검증은 UX 이고 최종 판정은 서버다"</i> 그대로다.
 */
public enum CodeErrorCode implements ErrorCode {

    GROUP_DUPLICATE(MsgKey.ERR_CODE_GROUP_DUPLICATE, "이미 있는 코드 그룹입니다"),
    GROUP_MISSING(MsgKey.ERR_CODE_GROUP_MISSING, "이미 삭제된 코드 그룹입니다"),
    /** 조회 뒤에 다른 사람이 코드를 추가했다 — screen/code/requirements.md 가 미리 적어 둔 동시성 창이다. */
    GROUP_HAS_CODE(MsgKey.ERR_CODE_GROUP_HAS_CODE, "코드가 있어 그룹을 지울 수 없습니다"),
    CODE_DUPLICATE(MsgKey.ERR_CODE_DUPLICATE, "이미 있는 코드입니다"),
    CODE_MISSING(MsgKey.ERR_CODE_MISSING, "이미 삭제된 코드입니다"),
    /** 화면이 만들 수 없는 조합이다 — FK 도 같은 것을 막는다(screen/code/requirements.md). */
    REF_DEF_UNKNOWN(MsgKey.ERR_CODE_REF_DEF_UNKNOWN, "이 그룹에 정의되지 않은 참조 코드입니다"),
    REF_DEF_DUPLICATE(MsgKey.ERR_CODE_REF_DEF_DUPLICATE, "이미 있는 참조 코드입니다"),
    /** {@code CODE_REF_KEY} 공통코드의 화이트리스트 밖이다 — sys/code.md. */
    REF_CD_UNKNOWN(MsgKey.ERR_CODE_REF_CD_UNKNOWN, "허용되지 않은 참조 코드 값입니다"),
    /** {@code SYS_YN='Y'} 인 행의 삭제·비활성 — sys/code.md. 화면에는 수단이 없다(screen/code/requirements.md). */
    SYSTEM_LOCKED(MsgKey.ERR_CODE_SYSTEM_LOCKED, "시스템 코드는 지우거나 끌 수 없습니다"),
    REQUIRED(MsgKey.ERR_CODE_REQUIRED, "필수 값이 비어 있습니다");

    private final String code;
    private final String defaultMessage;

    CodeErrorCode(String code, String defaultMessage) {
        this.code = code;
        this.defaultMessage = defaultMessage;
    }

    @Override
    public String code() {
        return code;
    }

    @Override
    public ErrorType type() {
        return ErrorType.INVALID_REQUEST;
    }

    @Override
    public String defaultMessage() {
        return defaultMessage;
    }
}
