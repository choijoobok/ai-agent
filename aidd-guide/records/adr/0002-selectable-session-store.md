# ADR-0002. 세션 스토어 선택형 (JDBC / Redis)

- 상태: 채택
- 일자: 2026-08-26

## 맥락
서버 다중화 환경에서 세션을 외부화해야 한다. 다만 모든 도입 프로젝트가
Redis 를 운영할 수 있는 것은 아니다.

## 결정
Spring Session 을 사용하되 **설정으로** `none` / `jdbc` / `redis` 를 선택한다.
기본값은 **`jdbc`**. 두 구현체를 모두 클래스패스에 포함하고, 애플리케이션 코드에는
분기를 두지 않는다.

> **개정(2026-08-28) — 선택 수단이 바뀌었다.** 원래는 `spring.session.store-type` 이었으나
> **Spring Boot 4 에 그 프로퍼티가 없다.** 적어도 오류가 나지 않고 무시되며, 스토어는
> 클래스패스의 자동설정이 정한다(둘 다 있으면 Redis 승). 그래서 선택을
> **`spring.autoconfigure.exclude`** 로 표현한다 — [23](../../standard/backend/_study/security-design.md) §2.
> **결정 자체는 유지된다**: 선택형이고, 둘 다 클래스패스에 있고, 코드 분기가 없다.

인증 방식은 **세션 기반**으로 하고 JWT 는 채택하지 않는다.

## 근거
- 강제 로그아웃·동시 접속 제어·세션 만료 예고가 요구사항에 있고, 이는 서버 상태를 전제한다.
  JWT 로 구현하면 블랙리스트 저장소가 필요해져 결국 상태를 갖게 된다.
- Redis 를 필수 인프라로 강제하지 않으면서 다중화를 지원하려면 JDBC 스토어가 필요하다.
- 동일 오리진 브라우저 단일 클라이언트이므로 쿠키 세션이 가장 단순하다.

## 대안
| 대안 | 기각 사유 |
|---|---|
| JWT stateless | 강제 로그아웃/세션 관리 요구와 충돌 |
| Redis 전용 | Redis 없는 환경 배제 |
| 스티키 세션 | 무중단 배포 시 세션 유실, LB 의존 |

## 결과
- JDBC 스토어는 세션 조회가 DB 부하로 간다. 만료 세션 정리 배치가 필요하다.
- 세션에 담는 principal 객체 직렬화 호환성을 관리해야 한다 (무중단 배포 시 역직렬화 실패 위험).
- ~~캐시(Caffeine/Redis)도 같은 선택형 구조를 따르되, **다중화 환경 권장 조합은 Redis** 로 안내한다.~~

> **개정(2026-08-25) — [ADR-0017](./0017-cache-strategy-per-target.md).** 캐시 전략을 대상별로 나눈 결과
> **공유 캐시를 요구하는 항목이 남지 않았다.** 다중화라고 Redis 를 권장하지 않는다 —
> 세션·중복방어·분산 락·진행률이 전부 JDBC 로 동작하므로 **Redis 는 다중화의 전제가 아니다.**

## 후속 — 스토어를 고르는 것만으로는 부족했다 (2026-08-30)

**선택형의 대가가 하나 드러났다.** 이 ADR 은 스토어를 *jdbc · redis · none* 으로 고를 수
있게 했는데, **Redis 쪽은 고르는 것이 두 번**이었다.

| Spring Session 4.1 의 Redis 구현 | `FindByIndexNameSessionRepository` |
|---|---|
| `RedisSessionRepository` | **없다** ← `repository-type` 의 **기본값**이 이것이다 |
| `RedisIndexedSessionRepository` | 있다 (`repository-type: indexed`) |

강제 로그아웃(AUTH-10) · 동시 접속 제어(AUTH-09) · 권한 무효화(`authzDirty`)가 전부 그
인덱스를 쓰므로([23](../../standard/backend/_study/security-design.md) §4 · §4-1), 인덱스 없는 쪽을 고르면 **셋이 함께 조용히
꺼진다.** 이 ADR 이 *"JWT stateless 는 강제 로그아웃 요구와 충돌한다"* 며 기각한 바로 그
상태가 **Redis 를 골랐을 때 기본값으로** 돌아온 셈이다.

**그래서 선택지를 하나 줄인다** — Redis 는 `indexed` 로만 지원하며, 인덱스 없는 스토어가
붙으면 **기동이 실패한다**(`SecurityConfig.sessionRegistry`). 조용한 폴백이 만드는 것은
**제어가 걸려 있다고 믿는 무제한 배포**이고, 그것은 배포자가 보아야 할 실패다.
