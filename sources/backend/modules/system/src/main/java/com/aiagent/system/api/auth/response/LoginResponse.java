// @feat FEAT-501
package com.aiagent.system.api.auth.response;

import com.aiagent.domain.authz.EffectiveAuthority;
import com.aiagent.domain.authz.MenuNode;
import java.util.List;
import java.util.Map;

/**
 * 로그인 · 세션 복원의 공통 응답 — backend/security.md ·.
 *
 * <p><b>프론트에는 평탄화된 (메뉴, 액션) 집합만 내린다.</b> 역할명은 내려가지 않는다 —
 * {@code if (roles.includes('ADMIN'))} 식의 분기가 생기면 역할을 신설할 때마다 프론트를
 * 고쳐야 하고, <b>인가 사실의 원본이 데이터 하나</b>라는 규칙이 깨진다(backend/security.md).
 *
 * <p><b>{@code menuTree} 가 여기 있는 것이 결정이다</b>(2026-08-29 정정). 인가 슬라이스는
 * 트리를 <i>"별도 API 로 온다"</i> 로 미뤄 두었는데, 는 셸 렌더를 막는 호출을 <b>둘</b>로
 * 고정해 두었다 — 로그인 응답과 메시지 번들. 트리가 없으면 사이더를 그릴 수 없으므로 그것을
 * 별도 호출로 두면 <b>막는 호출이 셋</b>이 되어 그 표와 어긋난다.
 *
 * <p>{@code menus} 는 그 트리의 <b>리프 코드 목록</b>이며 중복이 아니다 — 프론트의 권한 판정
 * ({@code hasPermission}·{@code canEnterMenu})은 코드 하나를 묻지 트리를 순회하지 않는다.
 * 트리는 <b>그리는 것</b>이고 이 목록은 <b>묻는 것</b>이다.
 *
 * <p><b>{@code cacheVersions} 는 사용자별이 아닌데도 여기 실린다</b>(sys/code.md). 값이 아니라
 * <b>값의 유효성 기준</b>이며 몇 바이트다 — 이것 하나 때문에 왕복을 더 두면 로그인마다
 * 호출이 하나 는다. 의 경계(<i>사용자별은 응답에, 전역은 번들에</i>)는 <b>덩치 큰
 * 데이터</b>에 대한 것이고, 이 값은 그 데이터를 <b>받을지 말지</b> 를 정하는 신호다.
 *
 * <p><b>{@code expiresInSeconds} 는 셸이 예고 시점을 잡는 근거다</b>. 만료 5분 전에
 * 모달을 띄우려면 <b>만료까지의 예산</b>을 알아야 하는데, 프론트에 30분을 박아 두면 서버
 * 설정({@code spring.session.timeout})과 어긋나고 그 어긋남은 <b>모달이 늦게 뜨거나 안
 * 뜨는 것</b>으로만 드러난다. 하트비트 응답이 나르는 값과 같은 것이며(screen/_standalone/README.md), 여기 실어
 * 두는 이유는 <b>부팅 직후부터 타이머가 필요하기 때문</b>이다 — 없으면 셸이 그 값을 얻으려
 * 하트비트를 한 번 불러야 하고, 그것은 사람이 누르지 않은 세션 연장이다.
 *
 * <p><b>{@code excelMaxRows} 는 {@code cacheVersions} 와 같은 성격이다</b>(playbook/excel-download.md · sys/code.md) —
 * 사용자별이 아니고 값도 아니지만 <b>화면이 판단하는 데 필요한 기준</b>이며 몇 바이트다.
 * 엑셀 <i>전체</i> 를 누른 순간 <b>총 건수와 이 상한을 비교</b>해야 하는데, 그때 물으면
 * 클릭에 왕복이 하나 붙고 프론트에 숫자를 박아 두면 {@code SYS_CONFIG} 와 어긋난다 —
 * 어긋남은 <b>거부되어야 할 다운로드가 통과하는 것</b>으로만 드러난다.
 *
 * <p><b>{@code searchRangeDefaultDays}·{@code searchRangeMaxDays} 도 같은 자리다</b>(sys/code.md ·
 * screen/log/access/requirements.md). 조회 기간의 <b>시스템 층</b>이며 화면은 그것을 <i>더 좁게</i> 덮는다 — 사용 이력이
 * 1 · 31 이다(screen/log/access/requirements.md). 프론트에 7 · 92 를 박아 두면 {@code SYS_CONFIG} 와 어긋나고, 그
 * 어긋남은 <b>폼이 통과시킨 조회를 서버가 400 으로 거부하는 것</b>으로만 드러난다.
 *
 * <p><b>{@code dateFormat} 도 같은 자리다</b>(sys/code.md · frontend/grid.md). 날짜 표시 형식이며
 * 사용자별이 아니지만 <b>화면이 값을 그리는 데 필요한 기준</b>이다 — 셀마다 물을 수 없고,
 * 프론트에 ISO 를 박아 두면 {@code SYS_CONFIG} 를 고쳐도 화면이 그대로다. 형식 셋을 한
 * 객체로 담는 것은 <b>셋이 함께 쓰이기</b> 때문이며(정밀도 표 — frontend/grid.md), 평평하게 펴면
 * 이 응답에 문자열 셋이 나란히 늘어선다.
 *
 * <p>{@code mustChangePassword} 는 체인 #5 이며 <b>차단이 아니라 유도</b>다. 참이면 세션은
 * 만들어지되 비밀번호 변경 API 외에는 403 이 된다 — 그것을 집행하는 것은 인가 인터셉터다.
 */
public record LoginResponse(
        LoginUserResponse user,
        boolean mustChangePassword,
        List<String> menus,
        List<String> permissions,
        List<MenuNode> menuTree,
        Map<String, Long> cacheVersions,
        int expiresInSeconds,
        int excelMaxRows,
        int excelMaxUploadRows,
        int searchRangeDefaultDays,
        int searchRangeMaxDays,
        DateFormatResponse dateFormat) {

    /**
     * 날짜 표시 형식 셋 — frontend/grid.md 의 정밀도 표와 1:1 이다.
     *
     * <p>{@code dayjs} 의 형식 문자열이며 <b>서버는 이 값을 쓰지 않는다</b> — 값을 그리는
     * 것은 화면이고(frontend/grid.md) 여기서는 나르기만 한다.
     */
    public record DateFormatResponse(String month, String day, String second) {}

    public static LoginResponse of(
            LoginUserResponse user,
            boolean mustChangePassword,
            EffectiveAuthority authority,
            List<MenuNode> menuTree,
            Map<String, Long> cacheVersions,
            int expiresInSeconds,
            int excelMaxRows,
            int excelMaxUploadRows,
            int searchRangeDefaultDays,
            int searchRangeMaxDays,
            DateFormatResponse dateFormat) {
        return new LoginResponse(
                user,
                mustChangePassword,
                authority.menuCodes(),
                authority.permissionTokens(),
                menuTree,
                cacheVersions,
                expiresInSeconds,
                excelMaxRows,
                excelMaxUploadRows,
                searchRangeDefaultDays,
                searchRangeMaxDays,
                dateFormat);
    }
}
