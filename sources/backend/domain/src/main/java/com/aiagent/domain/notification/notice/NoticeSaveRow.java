package com.aiagent.domain.notification.notice;

import com.aiagent.core.grid.RowState;
import com.aiagent.domain.notification.entity.SysNotice;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;

/**
 * 마스터 저장의 한 행 — screen/notice/requirements.md · frontend/grid.md.
 *
 * <p><b>{@code noticeStat} 이 없다.</b> 서버가 계산하는 파생 값이라 받을 경로를 두면
 * <b>화면이 게시 여부를 스스로 정하는</b> 셈이 된다 — 읽기 전용은 화면에서만 읽기
 * 전용이고 요청 본문은 조작할 수 있다(원칙 P1). {@code BatchScheduleSaveRow} 가 파생
 * 셋을 뺀 것과 같은 장치다.
 *
 * <p><b>{@code contentTypeCd} 도 없다</b>(screen/notice/requirements.md). 받으면 화면이 {@code HTML} 을 저장할
 * 수 있게 되는데 <b>표시 측이 아직 분기하지 않아</b> 태그가 글자로 보인다.
 *
 * <p>{@code noticeId} 는 신규 행에서 {@code null} 이고(채번) 수정·삭제에서는 <b>대상을
 * 가리키는 값</b>이다.
 *
 * <p><b>{@code @NotNull} 이 {@code noticeFromDtm} 에 붙지 않는다.</b> 삭제 행({@code D})은
 * 대상만 있으면 되기 때문이며, 필수 검증은 {@code NoticeService} 가 상태를 보고
 * 한다 — {@code BatchScheduleSaveRow} 가 이름·설명을 그렇게 다룬 것과 같다.
 */
public record NoticeSaveRow(
        @NotNull RowState rowState,
        Long noticeId,
        @Size(max = SysNotice.TITLE_MAX) String title,
        String content,
        Instant noticeFromDtm,
        Instant noticeToDtm,
        Boolean popupYn,
        Instant popupFromDtm,
        Instant popupToDtm,
        Boolean useYn,
        @Min(0) Integer sortNo) {

    /** <b>{@code null} 이면 게시한다</b> — {@code BatchScheduleSaveRow.useYnOrTrue} 와 같은 규칙. */
    public boolean useYnOrTrue() {
        return !Boolean.FALSE.equals(useYn);
    }

    /** <b>{@code null} 이면 팝업이 아니다</b> — 켜는 것은 명시여야 한다. 전 사용자에게 뜬다. */
    public boolean popupYnOrFalse() {
        return Boolean.TRUE.equals(popupYn);
    }

    /** {@code null} 이면 맨 앞이 아니라 <b>기본값 0</b> 이다 — 고정하지 않은 공지끼리는 날짜순이다. */
    public int sortNoOrZero() {
        return sortNo == null ? 0 : sortNo;
    }
}
