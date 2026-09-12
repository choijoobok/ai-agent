// @feat FEAT-502
package com.aiagent.system.domain.role;

import com.aiagent.core.error.ErrorCode;
import com.aiagent.core.error.ErrorType;
import com.aiagent.core.message.MsgKey;

/**
 * 역할 저장이 거부하는 것 — screen/menu/requirements.md · sys/menu.md.
 *
 * <p><b>전부 서버가 마지막으로 막는 것이다.</b> 화면도 같은 것을 막지만(삭제 컬럼 비활성 ·
 * 스위치 잠금) 그것은 <b>UX 이지 방어가 아니다</b>(backend/security.md) — 시드·직접 UPDATE·API 조작은 화면을
 * 지나지 않는다.
 *
 * <p><b>{@link #NOT_DELETABLE} 만 화면이 앞서 막는다.</b> 마스터의 건수 컬럼이 그 근거이고
 * (screen/admin/system/role/requirements.md) 그래도 <b>동시성으로 뚫린다</b> — 판정과 저장 사이에 누가 부여를 만들 수 있고,
 * 그때 이 문구가 저장 실패 모달로 나간다(screen/admin/system/role/requirements.md). <i>화면이 미리 막는 것은 저장 시점의
 * 실패를 조회 시점에 알리는 일이지 보증이 아니다.</i>
 */
public enum RoleErrorCode implements ErrorCode {

    DUPLICATE_ID(MsgKey.ERR_ROLE_DUPLICATE, "이미 있는 역할 ID 입니다"),
    NOT_FOUND(MsgKey.ERR_ROLE_NOT_FOUND, "없는 역할입니다"),
    NOT_DELETABLE(MsgKey.ERR_ROLE_NOT_DELETABLE, "보유 사용자나 권한이 있어 삭제할 수 없습니다"),
    NAME_REQUIRED(MsgKey.ERR_ROLE_NAME_REQUIRED, "역할명은 필수입니다"),
    MENU_NOT_AUTHORIZABLE(MsgKey.ERR_ROLE_AUTH_MENU, "권한을 줄 수 없는 메뉴입니다"),
    ACTION_UNDEFINED(MsgKey.ERR_ROLE_AUTH_ACTION, "그 메뉴에 그 액션의 API 가 없습니다"),
    READ_REQUIRED(MsgKey.ERR_ROLE_AUTH_READ, "조회 권한 없이 다른 액션만 줄 수 없습니다");

    private final String code;
    private final String defaultMessage;

    RoleErrorCode(String code, String defaultMessage) {
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
