package com.aiagent.api.code.response;

import java.util.List;
import java.util.Map;

/**
 * 그룹별 코드값 — 43 §8 · §8.1.
 *
 * <p><b>{@code version} 이 함께 온다.</b> 프론트는 로그인 응답의 {@code cacheVersions.code}
 * 로 캐시를 버릴지 판정하는데(43 §8.1), 그 판정과 이 적재 사이에 코드가 저장될 수 있다 —
 * 그러면 <b>낡은 버전이 새 데이터에 찍힌다</b>. 데이터를 실제로 뜬 시점의 버전을 함께
 * 보내면 캐시 항목이 자기 버전을 스스로 안다.
 *
 * @param version {@code SYS_CACHE_VERSION('code')}
 * @param groups {@code GRP_CD → DTL_CD 목록}. <b>요청한 그룹은 없는 것도 키로 들어 있다</b>
 */
public record CodeListResponse(long version, Map<String, List<String>> groups) {}
