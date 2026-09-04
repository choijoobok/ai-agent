package com.aiagent.domain.code.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 하단·정의 모달 조회의 <b>부모 키</b> — backend/api.md.
 *
 * <p><b>조건이 아니라 {@code params} 인 이유</b>는 이것이 <i>사용자가 좁힌 것</i> 이 아니라
 * <b>화면의 구조</b>이기 때문이다. 조건 목록에 두면 화이트리스트를 지나며 <b>선택적</b>이
 * 되고, 화면이 빠뜨린 요청 하나가 전 그룹의 코드를 한 판에 쏟는다 — {@code @NotBlank} 가
 * 그것을 400 으로 만든다.
 *
 * <p>레코드라 <b>열린 맵이 아니다</b> — 서비스가 이름으로 직접 읽으므로 인젝션 표면도
 * 화이트리스트도 필요 없다(backend/api.md).
 */
public record CodeGroupParams(@NotBlank @Size(max = 30) String grpCd) {}
