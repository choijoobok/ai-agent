package com.aiagent.api.system.response;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * 시스템 정보 — main-shell.md §7.3. 알림 모달 우측 하단의 팝오버가 읽는 전부다.
 *
 * <p><b>답해야 할 물음이 하나다 — <i>"지금 도는 서버가 어느 빌드인가"</i>.</b> 운영 문의는
 * 언제나 그 물음으로 시작하며, 그것을 사용자가 화면에서 읽어 줄 수 없으면 확인 경로가
 * <b>서버에 접속하는 것</b>밖에 없다.
 *
 * <p><b>{@code version} 만으로는 답이 되지 않는다.</b> 릴리스 태그를 붙이기 전까지 그 값은
 * 계속 {@code 0.0.1-SNAPSHOT} 이고 어제 배포와 오늘 배포가 구분되지 않는다 — 그래서
 * {@code commit} 이 함께 있다. 뒤에 {@code -dirty} 가 붙었다면 <b>고친 것이 있는 채로 만든
 * 빌드</b>이며 그 해시가 가리키는 커밋과 같지 않다.
 *
 * <p><b>{@code buildTime} 과 {@code startedAt} 은 다른 것이다.</b> 앞은 <i>언제 만들어진
 * 빌드인가</i>(=배포된 것), 뒤는 <i>언제 마지막으로 올라왔는가</i>(=재기동). 둘이 갈리면
 * <b>배포 없이 재기동만 한 것</b>이며, 그 구분이 없으면 <i>"배포했는데 안 바뀌었다"</i> 의
 * 원인을 좁힐 수 없다.
 *
 * <p><b>비어 있을 수 있다.</b> {@code build-info.properties} 는 Gradle 이 만들므로 IDE 가
 * 클래스만 컴파일해 띄운 서버에는 없다 — 그때 {@code version}·{@code commit}·
 * {@code buildTime} 이 {@code null} 이며, 화면은 <b>모른다</b>고 말한다. 없는 것을
 * 있는 것처럼 채우면 그 값이 곧 잘못된 단서가 된다.
 *
 * @param profiles 활성 Spring 프로필. 비면 {@code default} 하나로 도는 중이다
 * @param cacheVersions {@code SYS_CACHE_VERSION} 전건 — 프론트 캐시가 낡았는지 대조할 근거다(43 §8.1)
 */
public record SystemInfoResponse(
        List<String> profiles,
        String version,
        String commit,
        String branch,
        Instant buildTime,
        Instant startedAt,
        Map<String, Long> cacheVersions) {}
