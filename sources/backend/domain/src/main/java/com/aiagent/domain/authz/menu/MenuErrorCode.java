package com.aiagent.domain.authz.menu;

import com.aiagent.core.error.ErrorCode;
import com.aiagent.core.error.ErrorType;
import com.aiagent.core.message.MsgKey;

/**
 * 메뉴 트리 저장이 거부하는 것 — 42 §4 · 62 §4.
 *
 * <p><b>전부 서버가 마지막으로 막는 것이다.</b> 화면도 같은 것을 막지만(드롭 금지 · 비활성)
 * 그것은 <b>UX 이지 방어가 아니다</b>(security-design.md §4) — 시드·직접 UPDATE·API 조작은 화면을 지나지
 * 않는다.
 *
 * <p><b>{@link #TREE_CHANGED} 만 성질이 다르다.</b> 나머지는 <i>해서는 안 되는 일</i>이고
 * 이것은 <i>당신이 보던 트리가 낡았다</i> 이다 — 사용자는 조회 한 번으로 복구한다. 조용히
 * 덮어쓰는 대신 <b>시끄러운 실패</b>로 바꾼 것이 42 §4 의 판단이다.
 */
public enum MenuErrorCode implements ErrorCode {

    TREE_CHANGED(MsgKey.ERR_MENU_TREE_CHANGED, "트리가 변경되었습니다. 다시 불러오세요"),
    CYCLE(MsgKey.ERR_MENU_CYCLE, "자기 자신이나 하위 메뉴 아래로 옮길 수 없습니다"),
    DEPTH_EXCEEDED(MsgKey.ERR_MENU_DEPTH, "메뉴 깊이 상한을 넘습니다"),
    URL_ON_PARENT(MsgKey.ERR_MENU_URL_ON_PARENT, "하위 메뉴가 있는 메뉴는 화면을 가질 수 없습니다"),
    CHILD_UNDER_LEAF(MsgKey.ERR_MENU_CHILD_UNDER_LEAF, "화면이 있는 메뉴에는 하위를 둘 수 없습니다"),
    URL_REQUIRED_BY_AUTH(MsgKey.ERR_MENU_URL_REQUIRED, "권한이 부여된 메뉴는 화면을 비울 수 없습니다"),
    DUPLICATE_CODE(MsgKey.ERR_MENU_DUPLICATE, "이미 있는 메뉴 코드입니다"),
    NOT_DELETABLE(MsgKey.ERR_MENU_NOT_DELETABLE, "다른 곳에서 쓰고 있어 삭제할 수 없습니다"),
    NOT_FOUND(MsgKey.ERR_MENU_NOT_FOUND, "없는 메뉴입니다");

    private final String code;
    private final String defaultMessage;

    MenuErrorCode(String code, String defaultMessage) {
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
