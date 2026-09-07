---
id: LLM-FWK-BE-016
title: "메일 — 설정이 스위치다 · 던지지 않는다"
category: standard/backend
type: operation
class: policy
created: 2026-09-07
updated: 2026-09-07
status: active
sources: ["sources/backend/support/mail/", "sources/backend/bootstrap/src/main/resources/application.yml", "aidd-guide/knowledge/sys/notification.md"]
tier: 2
tags: [backend, mail, smtp, notification]
---

# 메일 — 설정이 스위치다 · 던지지 않는다

> **메일은 없을 수 있는 경로다.** 폐쇄망에 SMTP 가 없는 곳이 실재하고, 그것이 결손이
> 아니라 **정상 배포 형태**다. 그래서 `Mailer#send` 는 예외를 던지지 않고 *보냈는가* 를
> 답하며, **부르는 쪽은 실패해도 흐름을 멈추지 않는 자리여야 한다.**

## 1. 설정이 곧 스위치다 — `enabled` 플래그가 없다

`spring.mail.host` 를 두면 자동설정이 발송 빈을 만들고 `Mailer` 가 그것을 찾는다. 두지
않으면 빈이 없고 `send` 는 `false` 를 준다.

**따로 `enabled` 를 두지 않는 것이 요점이다.** 두면 조용한 오설정이 **둘** 생긴다 —
*호스트는 있는데 꺼져 있다* 와 *켜져 있는데 호스트가 없다*. 어느 쪽도 기동을 막지 않고,
둘 다 "메일이 안 온다" 로만 드러난다.

## 2. 보장하는 것 — 부르는 쪽의 계약 셋

| | |
|---|---|
| **던지지 않는다** | `boolean` 을 준다. `try/catch` 로 감싸지 않는다 — 감싸면 실패 처리 규칙이 호출부마다 흩어진다 |
| **`true` 는 도달이 아니다** | **SMTP 가 받은 시점까지**다. 그 뒤의 반송은 이 경로로 돌아오지 않는다 — *보냈으니 받았다* 를 전제한 업무 규칙을 세우지 않는다 |
| **문구는 부르는 쪽이 조립한다** | `Mailer` 는 업무를 하나도 알지 않는다. 본문은 **평문**이며 값은 `SYS_MESSAGE` 에서 온다 |

**HTML 도 템플릿 엔진도 두지 않는다.** 본문이 `SYS_MESSAGE` 의 값이라 다국어와 운영 중
수정이 공짜이고, 템플릿을 끼우는 순간 그 둘을 템플릿 파일이 다시 가져간다. 메일 본문
키는 `MsgKey` 의 메일 구역에 모여 있다([knowledge/sys/message.md](../../knowledge/sys/message.md)).

## 3. 실패는 로그 한 줄이 유일한 흔적이다

사용자에게 보이지 않는 실패이기 때문이다. **분실 비밀번호 재설정은 발송 성공 여부와
무관하게 같은 응답을 준다** — 계정 열거를 막는 규칙이 *항상 같은 응답* 이라, 메일이
없다는 사실도 사용자에게는 보이지 않는다.

- **본문과 제목을 로그에 남기지 않는다.** 재설정 인증번호가 본문에 있다.
- 남기는 것은 수신 주소와 실패 사유다 — 그것이 없으면 *"메일이 안 온다"* 는 문의에 대고
  확인할 것이 아무것도 없다.

## 4. 메일이 없는 배포에서의 복구 경로

**메일을 켜지 않는다.** 잠긴 계정의 복구는 **관리자 임시 발급**이며, 그래서
`sys-config` 의 관리자 재발급 스위치가 **기본으로 켜져 있다.** 메일을 유일한 복구
경로로 두면 SMTP 가 없는 현장에서 잠긴 계정이 영구히 잠긴다.

## 5. 의존성이 두 모듈로 갈려 있다

| 모듈 | 무엇 | 왜 |
|---|---|---|
| `support` | `spring-context-support` — `org.springframework.mail` 한 패키지 | `Mailer` 가 쓰는 것은 `MailSender` 와 `SimpleMailMessage` 둘이고 **그 둘은 `jakarta.mail` 을 요구하지 않는다** |
| `bootstrap` | `spring-boot-starter-mail` — **`runtimeOnly`** | 구현과 자동설정은 실행 시점의 것이다 |

**그래서 `support` 는 메일 구현에 묶이지 않는다** — 발송 빈이 없는 배포에서도 컴파일도
기동도 되고, 없을 때의 동작을 `Mailer` 가 정하는 것이 「설정이 스위치다」의 나머지 절반이다.
**스타터가 있어도 `spring.mail.host` 가 없으면 발송 빈은 만들어지지 않는다.**

**`@ConditionalOnBean` 을 쓰지 않는다.** 발송 빈은 자동설정이 만들고 그것은 사용자 설정
보다 뒤에 평가되므로, 조건을 걸면 **빈이 있어도 언제나 거짓**이 된다.

## 6. 새 메일을 더할 때

1. **실패해도 흐름을 멈추지 않는 자리인가** — 아니면 메일이 아니다. 알림함
   (`SYS_NOTI_INBOX`)을 본다([knowledge/sys/notification.md](../../knowledge/sys/notification.md)).
2. 본문·제목 키를 `MsgKey` 에 넣고 **시드를 다시 만든다**([seed.md](../seed.md)).
3. `send` 의 반환을 **무시하지 않는다** — 최소한 업무 로그에 남긴다.

## 관련

- [knowledge/sys/notification.md](../../knowledge/sys/notification.md) — 공지 · 알림 · 요청이 갈리는 축
- [knowledge/sys/message.md](../../knowledge/sys/message.md) — 문구의 정본은 `SYS_MESSAGE` 다
- [security.md](./security.md) — 계정 열거 방지 · 접근 제어 체인
- [seed.md](../seed.md) — 메시지 키 시드
