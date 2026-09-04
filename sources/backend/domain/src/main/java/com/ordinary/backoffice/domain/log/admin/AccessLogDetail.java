package com.ordinary.backoffice.domain.log.admin;

/**
 * 요청 전문 하나 — 64 §2.4. <b>한 행의 {@code nclob} 만 가져온다.</b>
 *
 * <p>목록이 이 값을 싣지 못하므로 {@code getDetail} 이 돌아왔다. 61 §3.4 가 편집 폼을
 * 없애며 {@code getDetail} 을 없앤 것과 정반대이며, <b>{@code getDetail} 의 존재 이유가
 * 편집 폼이 아니라 컬럼 하나</b>라는 것이 이 화면의 답이다.
 *
 * @param truncated 상한에서 잘렸는가 — architecture.md §6.2. <b>화면이 말하지 않으면</b> 잘린 JSON 을
 *     받은 사람이 <i>"저장이 깨졌다"</i> 로 읽는다(64 §2.4). 판정은
 *     {@link com.ordinary.backoffice.domain.log.LogText} 하나가 갖는다
 */
public record AccessLogDetail(Long accessLogSeq, String parameters, boolean truncated) {}
