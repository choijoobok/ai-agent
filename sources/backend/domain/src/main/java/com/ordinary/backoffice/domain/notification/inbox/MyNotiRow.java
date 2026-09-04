package com.ordinary.backoffice.domain.notification.inbox;

import com.ordinary.backoffice.domain.notification.NotiType;
import java.time.Instant;

/**
 * 알림 모달 <i>내 알림</i> 탭의 한 줄 — main-shell.md §7 · 60 §8.
 *
 * <p><b>{@code userId} 가 없다.</b> 언제나 세션의 주인이며, 실어 보내면 <i>다른 사람의
 * 알림도 올 수 있다</i> 는 오해를 계약이 만든다 — 부르는 쪽이 그것을 걸러야 하는 것처럼
 * 읽힌다.
 *
 * <p><b>{@code content} 는 목록에 실린다.</b> {@link NoticeBrief} 와 갈리는 자리이며 근거는
 * 47 §7 이 이미 냈다 — 알림의 본문은 <i>"길지 않다. 상세는 링크로 보낸다"</i> 이고 컬럼도
 * {@code VARCHAR(2000)} 이다. 한 줄 요약을 따로 만들 필요가 없다.
 *
 * @param linkMenuCd 클릭하면 갈 메뉴. {@code null} 이면 이동 없음이다(요청 처리 알림이
 *     그렇다 — 66 §5.4). <b>화면은 이 코드가 내 메뉴 트리에 있을 때만 이동 버튼을
 *     켠다</b>({@code NI-11}) — 권한이 없어진 메뉴로 보내 403 을 보이는 것보다 낫다.
 *     <b>알림이 권한을 주지 않는다</b>
 * @param readYn 열었는가. <b>배지가 세는 유일한 값</b>이다(main-shell.md §7.1)
 */
public record MyNotiRow(
        Long notiId,
        NotiType notiTypeCd,
        String title,
        String content,
        String linkMenuCd,
        String linkParam,
        Boolean readYn,
        Instant creDtm) {}
