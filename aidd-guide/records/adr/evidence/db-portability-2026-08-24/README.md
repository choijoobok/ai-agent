# DB 이식성 실측 — 2026-08-24 (벤더별 DDL 덤프)

**결론이 아니라 근거다.** 결론은 [DB 이식성 원문](../../../../standard/backend/_study/db-portability.md) §3.1 · §4.1 과
[ADR-0015](../../0015-table-based-id-generation.md) 에 있으며, 이 폴더는 그 문서가
*"실측했다"* 고 말할 때 **무엇을 보고 그랬는지**를 남긴 것이다.

| 폴더 | 무엇 |
|---|---|
| `01-before-sequence/` | `SEQUENCE` 전략일 때의 DDL — **MySQL 에서 Liquibase 가 `createSequence` 를 건너뛴다**(ADR-0015 가 그 전략을 기각한 근거) |
| `02-after-table/` | `TABLE` 전략으로 바꾼 뒤 — 5벤더가 **같은 테이블·컬럼**을 쓰는지(22 §4.1) |

각 폴더에 벤더별로 두 벌이 있다. `hibernate-*.sql` 은 런타임이 기대하는 모양이고
`liquibase-*.sql` 은 마이그레이션이 만드는 모양이다 — **둘이 갈리면 ID 가 중복 발급되고,
그 사고는 조용하다.** 두 벌을 나란히 둔 이유가 그것이다.

> **만든 코드는 없앴다** (2026-09-02). `spike/db-portability` 는 손으로 만든 축소판
> changelog 로 이 둘만 봤고, 22 §6.1 이 처음부터 *"산출물은 문서가 아니라 버릴 코드"* 로
> 정해 둔 것이다. 지금 4벤더를 확인하는 자리는 **실제 changelog** 를 태우는
> `:backend:bootstrap:portabilityTest` 와 `.github/workflows/db-portability.yml` 이다
> (48 §7.6). 여기 남긴 것은 **되돌아볼 수 없는 시점의 측정값**이라 코드와 함께 지울 수 없다.
