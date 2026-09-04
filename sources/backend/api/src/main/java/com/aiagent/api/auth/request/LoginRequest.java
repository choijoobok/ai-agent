package com.aiagent.api.auth.request;

import jakarta.validation.constraints.NotBlank;

/** 로그인 폼 — 60 §3.2. */
public record LoginRequest(
        @NotBlank String loginId,
        @NotBlank String password) {}
