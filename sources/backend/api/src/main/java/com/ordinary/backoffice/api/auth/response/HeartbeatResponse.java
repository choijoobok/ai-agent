package com.ordinary.backoffice.api.auth.response;

/** 다음 만료까지 남은 초. 프론트가 예고 시점을 다시 잡는다 — 60 §5. */
public record HeartbeatResponse(int expiresInSeconds) {}
