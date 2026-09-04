package com.ordinary.backoffice.domain.notification.notice;

import java.time.Instant;

/**
 * 마스터 그리드의 한 행 — 66 §4.2. <b>편집 폼이 없다</b>(grid-standard.md §1.1).
 *
 * <p>이 표가 목록이자 편집 화면이다. {@code CONTENT} 가 목록에 실리는 것이
 * {@code BatchScheduleRow.batchDesc} 와 같은 자리이며, 셀에서는 한 줄로 잘리고 전체는
 * {@code textModal} 이 연다(grid-column-contract.md §5.5).
 *
 * <p><b>{@code contentTypeCd} 가 없다.</b> 값이 {@code TEXT} 하나뿐이라 화면이 컬럼을
 * 감춘다(66 §4.3) — 내려보내면 그리드 설정에서 켤 수 있게 되고, 고를 것이 없는 컬럼이
 * 목록에 뜬다.
 *
 * @param noticeStat <b>파생이다</b>(66 §4.4). 저장된 컬럼이 아니라 {@code USE_YN} 과
 *     기간 둘의 조합이며 <b>서버가 판정한다</b> — 클라이언트가 계산하면 PC 시계가 틀린
 *     사람에게 다른 배지가 뜨고, 기준 시각은 브라우저가 아니라 업무 타임존이다(40 §4.3)
 */
public record NoticeRow(
        Integer sortNo,
        Long noticeId,
        String title,
        String content,
        Instant noticeFromDtm,
        Instant noticeToDtm,
        NoticeStatus noticeStat,
        Boolean useYn,
        Boolean popupYn,
        Instant popupFromDtm,
        Instant popupToDtm,
        String regId,
        Instant regDtm,
        String modId,
        Instant modDtm) {}
