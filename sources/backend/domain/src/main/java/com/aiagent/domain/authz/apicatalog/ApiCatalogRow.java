package com.aiagent.domain.authz.apicatalog;

import com.aiagent.domain.authz.ActionType;
import java.time.Instant;

/**
 * 마스터 그리드의 한 행 — 62 §5.3.
 *
 * <p><b>전 컬럼이 읽기 전용이다.</b> 원본이 시드이고 시드는 생성된다(ADR-0020) — 여기서
 * 고칠 수 있게 하면 다음 배포에서 사라진다(62 §5.6). 그래서 이 레코드에 짝이 되는
 * {@code SaveRow} 가 없다.
 *
 * @param menuCount 이 API 를 쓰는 메뉴 수 — <b>{@code 0} 이 곧 진단이다</b>(62 §5.4).
 *     {@code SYS_MENU_API} 에 행이 없으면 유효 권한의 원소가 되는 {@code (MENU_CD,
 *     ACTION_CD)} 쌍이 만들어지지 않아 <b>아무도 이 API 를 부를 수 없다</b>(security-design.md §4).
 *     하단을 조회하기 전에 답해야 하므로 마스터 응답이 갖는다
 * @param regDtm 감사 4컬럼이 아니라 <b>최종 시드 반영</b>이다(62 §5.3). 시드는 전건 삭제 후
 *     전건 삽입이라(ADR-0022) 전 행이 매번 다시 쓰이며 <b>전 행이 같은 값</b>이다 —
 *     <i>등록일</i> 로 보여주면 거짓말이 된다.
 *     <p><b>나머지 셋이 없다.</b> {@code REG_ID}·{@code MOD_ID} 는 언제나 시드 실행자 하나라
 *     열이 하나도 갈리지 않고, {@code MOD_DTM} 은 <b>언제나 {@code NULL}</b> 이다 — 전건
 *     삭제 후 전건 삽입에는 {@code UPDATE} 가 없다. 컬럼으로 두면 <b>영영 빈 칸</b>이 남고,
 *     그것은 <i>"왜 안 채워지나"</i> 를 묻게 만드는 자리다
 */
public record ApiCatalogRow(
        String apiUrl,
        String apiNm,
        String apiDesc,
        ActionType actionCd,
        long menuCount,
        Instant regDtm) {}
