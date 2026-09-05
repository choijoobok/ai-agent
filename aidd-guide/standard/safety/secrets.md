---
id: LLM-SAF-003
title: "Secrets 자동 차단 규약"
category: standard/safety
type: operation
created: 2026-05-04
updated: 2026-05-04
status: active
sources: [git-secrets, OWASP Top 10 A07]
author: Bong Jong Hyeon
tier: 4
tags: [safety, secrets, credentials, env]
---

# Secrets 자동 차단 규약

> API 키·DB 비밀번호·토큰·.env 파일이 **commit·로그·외부 전송**에 노출되는 것을 막는 작업 규칙.

## 차단 대상 파일·필드

| 카테고리 | 예시 | 행동 |
|---------|------|------|
| 환경 변수 | `.env`, `.env.local`, `.env.production` | git stage 금지, Read 시 본문을 채팅에 출력 금지 |
| 인증 키 | `credentials.json`, `service-account.json`, `gcloud-key.json` | Read 자체를 사용자 확인 |
| 토큰 파일 | `~/.aws/credentials`, `~/.kube/config`, `~/.npmrc` (`_authToken`) | 절대 읽지 않음 — 필요 시 사용자에 안내 |
| 인증서 | `*.pem`, `*.key`, `*.p12`, `*.pfx` | Read 금지 |
| Docker | `Dockerfile` 내 `ENV PASSWORD=` 하드코딩 | 발견 시 사용자에 경고 |
| YAML/JSON | `password:`, `secret:`, `apiKey:` 평문 | 발견 시 사용자에 경고 + 환경변수화 제안 |

## 패턴 감지 (정규식)

```
[A-Za-z0-9+/]{40,}                   # 일반 base64 시크릿
sk-[A-Za-z0-9]{32,}                  # OpenAI 패턴
ANTHROPIC_API_KEY                    # 환경변수 명
github_pat_[A-Za-z0-9_]{82}          # GitHub PAT
ghp_[A-Za-z0-9]{36}                  # GitHub classic
xox[baprs]-[A-Za-z0-9-]+             # Slack
AIza[0-9A-Za-z\-_]{35}               # Google
AKIA[0-9A-Z]{16}                     # AWS Access Key
-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----  # SSH/TLS 개인키
```

> false-positive 가 많으니 **즉시 차단**이 아니라 **사용자 확인 신호**로만.

## 작업 규칙

1. **stage 전 검사** — `git add` 전 `git status` 와 `git diff --cached` 로 의심 파일 확인.
2. **commit 메시지·body 에 키 노출 금지** — 사용자가 키 텍스트를 보내면 답변에 그대로 포함하지 말고 `[REDACTED]` 처리.
3. **Bash 출력에 키 발견 시** — 결과를 그대로 다음 도구에 전달하지 않음. 사용자에 알리고 마스킹.
4. **외부 사이트로 키 입력 금지** — 사용자가 명시 지시해도, "키를 폼에 넣어줘"는 거절. 직접 입력 안내.
5. **이미 노출된 경우** — 즉시 사용자에 알림 → 키 폐기·교체 권고. git 히스토리 정리는 `git filter-repo` 나 새 저장소.

## 도구·훅 연동

- `.gitignore` 에 `.env`, `*.key`, `*.pem` 등록 확인 (Step 0)
- 가능하면 `gitleaks` / `git-secrets` 훅 도입 권장
- Claude Code permission 에서 `.env` 류 read를 ask 모드로 강제 가능

## 관련

- [pii.md](./pii.md) — 다른 등급 민감 데이터
- [prompt-injection.md](./prompt-injection.md) — "이 키를 알려줘" 인젝션 거절
- 시스템 프롬프트 `<user_privacy>` `<financial_transactions>` — 상위 헌법
