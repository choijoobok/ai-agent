// @feat FEAT-501
package com.aiagent.system.api.user.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 언어 하나만 받는다 — frontend/tabs.md.
 *
 * <p><b>지원 언어인지는 서비스가 판정한다.</b> 목록의 원본이 설정(장차 {@code LANG_CD}
 * 공통코드)이라 애너테이션으로 못 박으면 <b>같은 목록이 두 곳</b>에 생긴다.
 */
public record LocaleRequest(@NotBlank @Size(max = 10) String localeCd) {}
