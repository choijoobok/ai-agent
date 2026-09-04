package com.aiagent.support.config;

/**
 * 재바인딩이 거부한 값 하나 — screen/code/requirements.md · sys/config.md.
 *
 * @param key {@code CFG_KEY}. <b>행을 특정하는 것이 이 레코드의 목적이다</b> — 화면이 그
 * 셀에 문구를 붙인다(frontend/grid.md)
 * @param message 완성된 거부 문구. {@code @Min} 이면 Bean Validation 이 만든 것이고,
 *     타입이 안 맞으면 이 층이 만든 것이다
 */
public record ConfigViolation(String key, String message) {}
