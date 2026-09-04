package com.aiagent.api.auth.request;

import jakarta.validation.constraints.NotBlank;

/** 로그인 폼 — screen/_standalone/README.md. */
public record LoginRequest(
        @NotBlank String loginId,
        @NotBlank String password) {}
