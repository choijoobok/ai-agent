package com.ordinary.backoffice.domain.message;

/** 번들 적재의 한 행 — 키·언어·값과 그 키의 사용처. 조회 한 번으로 둘을 함께 읽는다. */
public record MessageRow(String msgKey, String langCd, String msgVal, MessageScope useScope) {}
