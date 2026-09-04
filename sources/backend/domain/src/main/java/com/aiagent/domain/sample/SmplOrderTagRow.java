package com.aiagent.domain.sample;

/**
 * {@code TAG_LIST} 의 한 항목 — playbook/INDEX.md 의 21번 컬럼.
 *
 * <p><b>문자열이 아니라 객체다.</b> frontend/grid.md 이 {@code list} 항목을 객체로 열어 두었고,
 * 문자열 배열만 다루면 <b>그 문이 열려 있다는 사실에 실물이 없다</b>. 화면은
 * {@code display} 로 무엇을 보일지 정한다.
 */
public record SmplOrderTagRow(String tagNm, String tagTypeCd) {}
