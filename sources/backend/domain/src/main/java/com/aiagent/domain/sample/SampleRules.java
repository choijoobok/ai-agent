package com.aiagent.domain.sample;

import com.aiagent.core.error.BusinessException;
import com.aiagent.domain.sample.entity.SmplOrder;

/**
 * 저장 서비스 셋이 함께 보는 규칙 — 68 §5 · §7 · §8.
 *
 * <p><b>여기 있는 것은 세 서비스 중 둘 이상이 보는 것뿐이다.</b> 주문만의 기본값
 * ({@code DEFAULT_CHNL} · {@code DEFAULT_PRIORITY})은 {@link SampleOrderService} 가 갖고,
 * 품목 키는 {@link SampleItemService} 가 갖는다 — 한 곳만 쓰는 것을 여기 올리면 이 파일이
 * <i>샘플의 잡동사니</i> 가 된다.
 */
public final class SampleRules {

    /**
     * 한 주문의 태그 개수 상한 &mdash; 48 &sect;8 의 결정(2026-09-02).
     *
     * <h2>상한을 정하는 것은 기계가 아니라 창이다</h2>
     *
     * <p>기계는 훨씬 뒤에 무너진다. 엑셀은 배열을 구분자로 이어 붙이므로(54 &sect;5.6)
     * {@code VARCHAR(50)} 짜리 이름이 <b>630개</b> 쯤에서 셀 문자 상한을 넘고, 저장은
     * 전량 교체라 <b>1,000행 &times; 20개 = 인서트 2만</b> 이다. 먼저 무너지는 것은
     * {@code listModal} 이다 &mdash; 순서 변경이 <b>위&middot;아래 버튼</b>이라(68 &sect;9.6)
     * 마지막 항목을 맨 앞으로 옮기는 데 <b>N&minus;1 번</b> 을 눌러야 하고, 셀은 앞의 셋과
     * {@code +N} 만 그린다.
     *
     * <p>그래서 <b>20</b> 이다. 창에서 다룰 수 있는 마지막 자리이며(19번 클릭), 그 값에서
     * 엑셀은 1,040자로 상한의 3%다.
     *
     * <h2>설정 키로 두지 않는다</h2>
     *
     * <p>54 &sect;5.6 이 개수를 <b>업무 규칙</b>으로 못 박았다 &mdash; <i>"창고가 A 면
     * 최대 50개"</i> 가 성립하는 자리이므로 배포 전체에 걸리는 값이 아니다. 엑셀 상한이
     * 설정인 것과 갈리는 지점이 이것이다: 저것은 <b>이 배포의 기계</b>가 견디는 양이고
     * 이것은 <b>이 컬럼</b>의 규칙이다.
     *
     * <h2>&#9312;과 &#9316;이 한 값을 본다</h2>
     *
     * <p>갈라 두면 &#9316;에서 스물한 개를 만들 수 있고, 그러면 <b>&#9312;이 그 주문을
     * 저장할 수 없다</b> &mdash; 배열을 통째로 보내므로 자기가 만들지도 않은 개수에 걸린다.
     * 사용자에게는 <i>고친 것도 없는데 저장이 거부된다</i> 로 보인다. <b>그래서 이 상수가
     * 여기 있다</b>: 배열 교체({@link SampleOrderService})와 행 편집({@link SampleTagService})이
     * 서로 다른 클래스로 갈린 뒤에도 값은 하나여야 한다.
     */
    public static final int MAX_TAGS = 20;

    /** 태그 유형의 기본 — 사용자가 유형까지 고르지 않으면 <i>일반</i> 이다(48 §4.1). */
    static final String DEFAULT_TAG_TYPE = "GEN";

    private SampleRules() {}

    /**
     * 잠긴 주문은 고칠 수 없다 — {@code LOCK_YN} 은 상태와 다른 축이다(48 §3.2).
     *
     * <p>주문·품목·태그 <b>셋 다</b> 이 문을 지난다. 잠금이 뜻하는 것은 <i>이 주문에 딸린
     * 것을 아무도 건드리지 않는다</i> 이므로, 품목만 열려 있으면 그 뜻이 절반만 성립한다.
     */
    static void requireUnlocked(SmplOrder order) {
        if (Boolean.TRUE.equals(order.getLockYn())) {
            throw new BusinessException(SampleErrorCode.LOCKED, "locked: " + order.getOrdNo());
        }
    }

    /** 필수 문자열 — 화면이 이미 막았어도 다시 본다(grid-edit-validation.md §3.4). */
    static void requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new BusinessException(SampleErrorCode.REQUIRED, field + " is required");
        }
    }
}
