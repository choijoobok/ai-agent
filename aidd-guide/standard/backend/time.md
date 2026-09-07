---
id: LLM-FWK-BE-015
title: "시간 — 시각의 단일 출처 · 업무 달력 날짜"
category: standard/backend
type: operation
created: 2026-09-07
updated: 2026-09-07
status: active
sources: ["sources/backend/support/time/", "sources/backend/bootstrap/src/main/java/com/aiagent/config/TimeConfig.java", "aidd-guide/standard/backend/persistence.md"]
tier: 2
tags: [backend, time, clock, timezone, business-calendar]
---

# 시간 — 시각의 단일 출처 · 업무 달력 날짜

> **`now()` 를 코드에 흩지 않는다.** 시각은 `Clock` 빈에서, 업무 달력 날짜는
> `BusinessCalendar` 에서만 온다. 판정이 흩어지면 **자정 근처에서만 하루가 밀리고**,
> 그렇게 밀린 것은 **재현되지 않는다** — 버그 보고를 받아도 재현할 수 없다.

## 1. 둘은 다른 것이다

| | 무엇 | 어디서 | 무엇으로 |
|---|---|---|---|
| **시각** | 사건이 일어난 순간 — 생성·수정·로그 | `Clock` 빈 (`Clock.systemUTC()`) | UTC `Instant` |
| **업무 달력 날짜** | *오늘* · 사용 기간의 `_DT` 컬럼 | `BusinessCalendar#today()` | `LocalDate` |

**시간대가 없는 값이 문제의 뿌리다.** `_DT` 는 달력 값이라 *오늘이 무엇인가* 를 누군가
정해야 하는데, JVM 기본 시간대에 맡기면 **배포가 UTC 인지 KST 인지에 따라 답이 달라진다.**
그래서 시각과 날짜를 한 클래스로 합치지 않는다 — 합치면 저장 형식(UTC)과 판정 기준(업무
시간대)이 한 이름 뒤로 숨고, 어느 쪽이 쓰였는지 호출부에서 보이지 않는다.

## 2. 쓰지 않는 것 — 이것이 규약의 본체다

| 쓰지 않는다 | 대신 |
|---|---|
| `Instant.now()` · `LocalDateTime.now()` · `new Date()` | `clock.instant()` |
| `System.currentTimeMillis()` | 〃 — 시간대 문제는 없지만 **고정할 수 없는** 출처다 |
| `LocalDate.now()` | `calendar.today()` |
| `ZoneId.systemDefault()` | `calendar.zone()` |
| DB 함수 `SYSDATE` · `NOW()` | 위와 같다 — **금지의 뿌리가 같다**([persistence.md](./persistence.md)) |

**예외는 `Clock` 을 넘겨받은 호출뿐이다.** `Instant.now(clock)` 은 인자가 단일 출처이므로
규약을 지킨다 — 괄호가 빈 것만 금지다.

## 3. 쓰는 모양 — 생성자 주입

```java
public UserAccountService(SysUserRepository users, ConfigLookup configs, BusinessCalendar calendar) {
    this.calendar = calendar;
}

// 사용 기간이 지났나 — 달력 비교다
boolean expired = user.getUseEndDt().isBefore(calendar.today());
```

`BusinessCalendar` 가 주는 것은 셋이다 — `today()`(업무 시간대의 오늘) · `now()`(UTC 시각) ·
`zone()`(업무 시간대). **시각만 필요하면 `Clock` 을 직접 주입해도 된다** — `BusinessCalendar`
는 그 위의 편의이며, 달력 판정이 없는 곳에서 끌어오면 의존이 넓어진다.

## 4. 테스트는 시간을 고정한다

```java
new BusinessCalendar("Asia/Seoul", Clock.fixed(NOW, ZoneId.of("Asia/Seoul")))
```

**이것이 단일 출처의 값이다.** 만료·잠금·휴면처럼 *날짜가 지났나* 를 묻는 규칙은 고정
시계 없이는 **어제 통과하고 오늘 실패하는 테스트**가 된다. 계정 규칙 테스트 넷과 인가
인터셉터 테스트가 실제로 이 꼴을 쓴다.

## 5. 설정 — `app.business-timezone`

**배포 시 고정하며 `sys-config` 가 아니다.** 런타임 변경 대상이 아니기 때문이다: 바꾸면
**이미 저장된 `_DT` 의 뜻이 소급해 달라진다** — 어제까지 유효했던 계정이 오늘 만료로
읽힐 수 있고, 그 변화는 어느 이력에도 남지 않는다. 무엇을 `sys-config` 에 두나의 판단
기준은 [knowledge/sys/config.md](../../knowledge/sys/config.md) 가 갖는다.

## 6. 빌드가 §2 를 지킨다 — `TimeSourceConventionTest`

`./gradlew check` 가 프로덕션 코드(테스트 제외)의 바이트코드를 훑는다. **면제는 양방향으로
실패한다**: 목록에 없는 위반이 생기면 실패하고, **면제인데 위반이 사라져도 실패한다** —
뒤쪽이 없으면 면제가 영구 주석이 되고, 남은 면제는 다음 사람에게 *여기는 원래 그런 곳*
이라고 가르친다.

### 검사가 못 보는 것 — 프레임워크가 우리 대신 부를 때

`new CronTrigger(cron)` 은 시간대를 **스프링 안에서** `systemDefault()` 로 정한다. 우리
바이트코드에 그 호출이 없으므로 검사가 보지 못한다. **바이트코드를 보는 검사의 한계이며,
프레임워크에 시간대를 맡기는 API 를 쓸 때는 시간대를 명시로 넘긴다.**

### 지금 면제된 자리 하나

`CronRules#nextExecution` — 배치 목록의 파생 컬럼 *다음 실행* 이다. **여기만 업무 시간대로
고치면 표시와 실행이 어긋난다**: 실행 시각은 `BatchScheduler` 의 `CronTrigger` 가 정하고
그것도 JVM 기본 시간대를 쓴다. 둘을 함께 바꾸는 것은 **배치 동작의 변경**이므로
[INDEX.md](../INDEX.md) 의 「이미 있는 것을 고칠 때」 ③·⑦ 을 탄다.

## 관련

- [persistence.md](./persistence.md) — DB 함수 금지 · 저장은 UTC
- [knowledge/sys/config.md](../../knowledge/sys/config.md) — `sys-config` 에 둘 것과 두지 않을 것
- [INDEX.md](../INDEX.md) — 고칠 때의 절차 · 부류 둘
- `backend/bootstrap/src/test/java/com/aiagent/architecture/TimeSourceConventionTest.java` — §2 를 세는 것
