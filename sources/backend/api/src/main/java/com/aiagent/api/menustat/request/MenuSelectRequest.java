package com.aiagent.api.menustat.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 메뉴를 골랐다 — 42 §8.
 *
 * <p><b>{@code entryType} 이 없다.</b> 42 §8 은 진입 경로(TREE · SEARCH · FAVORITE …)를
 * 함께 받도록 적었는데 <b>그것을 읽는 곳이 아직 없다</b> — 경로가 필요한 이유는 분석뿐이고
 * 그 분석이 사는 자리는 사용 이력({@code SYS_LO_ACCESS})이다. 담을 곳 없는 값을 받으면
 * <b>계약이 거짓말</b>이 된다: 보내는 쪽은 기록되는 줄 안다.
 *
 * <p>나중에 <b>더하는</b> 것은 호환을 깨지 않는다 — 그때 로그 슬라이스와 함께 붙인다.
 */
public record MenuSelectRequest(@NotBlank @Size(max = 30) String menuCd) {}
