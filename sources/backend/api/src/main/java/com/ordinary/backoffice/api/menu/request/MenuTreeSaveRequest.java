package com.ordinary.backoffice.api.menu.request;

import com.ordinary.backoffice.domain.authz.menu.MenuSiblingGroup;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

/**
 * 위치 변경 — 42 §4. <b>드래그 한 번이 그룹 하나 또는 둘이다.</b>
 *
 * <p>같은 부모 안에서 순서만 바뀌면 하나, 부모가 바뀌면 <b>뺀 쪽과 넣은 쪽 둘</b>이다.
 * 42 §4 가 위치 연산을 메서드 하나로 모으라고 한 것이 여기서 <b>요청 하나</b>로 나타난다 —
 * 나눠 보내면 그 사이에 트리가 <i>양쪽 어디에도 속하지 않는 노드</i> 를 갖는 순간이 생긴다.
 */
public record MenuTreeSaveRequest(@NotEmpty List<@Valid MenuSiblingGroup> groups) {}
