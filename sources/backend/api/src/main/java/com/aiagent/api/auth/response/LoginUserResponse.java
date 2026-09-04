package com.aiagent.api.auth.response;

/** 세션 주체의 표시 정보. 비밀번호·플래그 원본은 내려보내지 않는다. */
public record LoginUserResponse(String userId, String userNm, String localeCd) {}
