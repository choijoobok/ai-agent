package com.aiagent.domain.sample;

/**
 * 참조 팝업이 고르는 한 행 — playbook/INDEX.md 의 {@code sample.customer}.
 *
 * <p><b>고객 테이블이 없다.</b> playbook/INDEX.md 가 담는 것을 두 테이블로 못 박았고, 팝업 하나를 위해
 * 셋째를 만들면 <b>아무도 쓰지 않는 마스터가 4벤더 CI 의 대상</b>이 된다. 그래서 후보를
 * 주문에서 <b>중복 없이</b> 뽑는다.
 *
 * <p><b>샘플이라서 성립하는 방식이다.</b> 실제 프로젝트에서 이 자리는 고객 마스터를 읽으며,
 * 그 사실이 <i>참조 팝업은 남의 마스터를 고르는 창</i> 이라는 어휘의 뜻이다(frontend/grid.md).
 * 여기서 보이려는 것은 <b>고르면 여러 칸이 함께 채워진다</b> 는 계약이지 조회의 출처가
 * 아니다.
 */
public record SmplCustomerRow(String custId, String custNm, String custGrdCd) {}
