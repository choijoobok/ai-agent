// @feat FEAT-504
package com.aiagent.system.api.code.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 콤보가 필요한 그룹들 — sys/code.md.
 *
 * <p><b>목록인 것이 요점이다.</b> 프론트 캐시가 필요한 이유가 <i>"한 화면이 콤보를 여러 개
 * 띄울 때의 왕복"</i> 이므로(sys/code.md), 그 화면이 <b>한 번에</b> 물을 수 있어야 한다 — 그룹당
 * 한 번씩 부르면 캐시가 비어 있는 첫 진입에서 왕복이 콤보 수만큼 난다.
 *
 * <p>상한 {@code 50} 은 방어값이다. 한 화면이 콤보를 쉰 개 띄우는 일은 없고, 그 수를 넘는
 * 요청은 <b>목록을 통째로 훑으려는 것</b>이지 화면이 필요로 하는 것이 아니다.
 */
public record CodeListRequest(
        @NotEmpty @Size(max = 50) List<@NotBlank @Size(max = 30) String> grpCds) {}
