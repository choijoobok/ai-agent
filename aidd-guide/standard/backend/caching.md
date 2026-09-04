---
id: LLM-FWK-BE-008
title: "캐시 — 대상마다 다른 백엔드 · SysCacheVersion"
category: "06-framework/backend"
type: operation
created: 2026-05-04
updated: 2026-09-03
status: active
sources: ["sources/backend/domain/message/", "sources/backend/bootstrap/src/main/resources/application.yml", "aidd-guide/standard/backend/security.md"]
author: Bong Jong Hyeon
tier: 2
tags: [backend, cache, invalidation]
---

# 캐시 — 대상마다 다른 백엔드 · `SysCacheVersion`

> **`@Cacheable` 을 쓰지 않는다.** 소스에 한 곳도 없다.
> 캐시를 한 덩어리로 보지 않고 **대상별로 나누면 노드 간 공유가 필요한 백엔드 캐시가
> 하나도 남지 않기** 때문이다 — 그러면 `CacheManager` 도, Redis 전제도 필요 없다.

## 1. 대상마다 백엔드가 다르다

| 대상 | 백엔드 | 근거 |
|---|---|---|
| **유효 권한** | **세션** | 매 요청 필요하지만 **낡으면 보안 결함** |
| **공통 코드 · 메뉴 트리** | **캐싱 없음** | 서버 부하가 문제가 아니다 — **프론트가 캐싱한다** |
| 시스템 설정 | **작업 스코프** | 한 덩어리 일 안에서 값이 바뀌면 안 된다 |
| **다국어 메시지** | **TTL 30분** (`app.message.cache-ttl-minutes`) | 건수가 많다. 낡아도 **옛 문구가 보일 뿐**이다 |
| PII 정의 | 애플리케이션 캐시 | 응답 직렬화마다 참조. 변경은 배포에 준한다 |

**"다중화 = Redis" 가 아니다.** 노드 간 공유가 필요한 캐시가 없으므로 `type: redis` 는
**고부하 배포의 선택지**이지 다중화의 전제가 아니다.

> **낡음의 대가로 백엔드를 고른다.** 유효 권한이 낡으면 **회수된 권한이 통과**한다 —
> 그래서 세션이다. 메시지가 낡으면 **옛 문구가 30분 보일 뿐**이다 — 그래서 TTL 이다.
> 대상을 뭉뚱그리면 가장 비싼 요구(즉시 일관성)를 전부에 물리게 된다.

## 2. `SysCacheVersion` — **프론트** 캐시의 유효성 기준

**백엔드 노드끼리 주고받는 신호가 아니다.** 폴링하지 않으며 읽는 시점은 **로그인과 공개
번들 요청 둘뿐**이다.

```
CODE_MGMT 저장 ─→ CacheVersionService.bump("code") ─→ SYS_CACHE_VERSION.VERSION++
                                                             │
로그인 · 번들 요청 ─────────────────────────────────────────→ 프론트가 버전을 비교하고
                                                             localStorage 를 버린다
```

| `CACHE_NAME` | 무엇을 버리나 | 누가 올리나 |
|---|---|---|
| `code` | 공통 코드 | `CODE_MGMT` 의 저장 셋 |
| `message` | 다국어 메시지 | `MESSAGE_MGMT` · **코드명을 고친 저장** |
| `config` | 시스템 환경설정 | `CONFIG_MGMT` 의 저장 |

> **코드명을 고친 저장은 `message` 도 함께 올린다.** 이름의 원본이 `SYS_MESSAGE` 라
> 프론트가 그 값을 **메시지 번들에서** 읽는다 — `code` 만 올리면 **목록은 새것인데
> 라벨이 옛것**인 화면이 나온다.

- **버전은 `CACHE_NAME` 단위다.** 코드 그룹 하나가 바뀌어도 프론트의 `code` 캐시 **전체**가
  버려진다. 그룹 단위로 두면 **표가 코드 그룹 수만큼 늘어난다.**
- **감사 4컬럼을 상속하지 않는다.** 애플리케이션이 기계적으로 쓰는 값이라 *"누가"* 가
  존재하지 않는다. `MOD_DTM` 만 진단용으로 둔다.

## 3. 메뉴 트리는 어디에도 캐시하지 않는다

세션에도 서버 캐시에도 두지 않는다. **로그인 후 프론트 메모리로 1회 내려간다.**

## 4. 새 캐시를 만들려 할 때

1. **정말 서버가 캐싱해야 하는가** — 프론트가 캐싱하면 되는 것이 대부분이다.
2. **낡으면 무슨 일이 일어나는가** — 보안 결함이면 세션, 표시 지연이면 TTL.
3. **노드 간 공유가 필요한가** — 필요하다면 그 판단을 먼저 검토한다. 지금은 하나도 없다.
4. **프론트 캐시를 버려야 하는가** — 그렇다면 `SYS_CACHE_VERSION` 에 이름을 더하고
   **저장 경로에서 `bump`** 한다.

## 관련

- [session.md](./session.md) — 세션 스토어 선택
- [security.md](./security.md) — 유효 권한이 세션에 있는 이유
- [`../../09-knowledge/sys/message.md`](../../knowledge/sys/message.md) — `SYS_CACHE_VERSION` 도메인
