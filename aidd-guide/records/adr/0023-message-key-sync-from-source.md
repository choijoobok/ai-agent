# ADR-0023. 메시지 키는 소스 상수에서 동기화한다 — **키는 코드가, 값은 사람이** 소유한다

- 상태: 채택
- 일자: 2026-08-28
- 관련: [ADR-0020](./0020-path-prefix-action-and-seed-generation.md) · [ADR-0022](./0022-generated-seed-full-sync.md) · [43-data-model-master](../../knowledge/sys/code.md) §7 · 화면 흐름 §3.2 · [63-screen-master](../../../documents/screen/code/requirements.md) §3 · [22-db-portability](../../standard/backend/_study/db-portability.md) §1.1

## 맥락

`SYS_MESSAGE` 를 설계할 때 **키가 어디서 오는지를 정하지 않았다.** 프론트와 백엔드가
문자열 리터럴로 `"user.list.title"` 을 쓰고, 관리 화면이 그 행을 손으로 만드는 구조였다.
거기서 셋이 함께 굴러 나왔다.

| 증상 | 어디서 드러났나 |
|---|---|
| **`MSG_GRP_CD` 가 두 가지 일을 한다** — 관리 화면 분류(데이터 · 관리자가 늘린다)와 **공개 번들 경계**(코드가 가진 닫힌 집합) | [63](../../../documents/screen/code/requirements.md) §3.4 — 집합이 모르는 그룹에 `미분류` 배지를 붙여야 했다 |
| **부분 함수 종속** — `MSG_GRP_CD` 는 `MSG_KEY` 에만 종속인데 PK 가 `(MSG_KEY, LANG_CD)` 다 | 같은 키의 `ko` 행과 `en` 행이 **다른 그룹일 수 있다**. 그룹 수정이 **행 N개를 `UPDATE`** 한다 |
| **마스터 행에 실체가 없다** | 키만 있는 행이 존재하지 않아 [53](../../standard/frontend/_study/grid-standard.md) §6.1 에 예외가 필요했다([63](../../../documents/screen/code/requirements.md) §3.2) |

그리고 **아무도 쓰지 않는 키를 알아낼 방법이 없었다.** 리터럴을 지우면 DB 행이 남고,
그 행이 죽었는지 살았는지는 **전 소스를 그랩해야** 알 수 있다.

> **[ADR-0020](./0020-path-prefix-action-and-seed-generation.md) 이 API 에 대해 이미 같은 문제를 풀었다.** 컨트롤러를 스캔해 `SYS_API` 를
> 만들고, 프론트 `endpoints` 선언에서 매핑을 만들고, 매핑 `0` 을 **미매핑**으로 진단한다.
> **메시지에는 그 장치가 없었다.**

## 결정

**넷을 함께 정한다.**

### 1. 키는 전역 상수다 — 리터럴을 금지한다

```ts
// 프론트 — shared/i18n/messageKeys.ts (24 §2.1: 두 번째 화면이 쓰는 순간 shared 다)
export const MSG = {
  USER_LIST_TITLE:  'user.list.title',
  ORDER_SAVE_DONE:  'order.save.done',
} as const;
```

```java
// 백엔드 — core 모듈의 MsgKey (21 §3: 전 모듈이 의존한다)
public final class MsgKey {
    /** 비밀번호 최소 길이 위반 */
    public static final String VALID_PASSWORD_MIN = "valid.password.min";
}
```

> **`ErrorCode` 도 키를 갖는다**(2026-08-29 — 구현). `ErrorCode.code()` 의 값(`err.login.failed`)이
> 곧 메시지 키다. 원본을 둘로 두지 않기 위해 **`ErrorCode` 구현이 `MsgKey` 상수를 참조**하며,
> `SeedMessageTest` 가 *"모든 `ErrorCode` 의 `code()` 가 `MsgKey` 에 있다"* 를 지킨다.
> 빠지면 조용하다 — 응답은 정상이고 그 키만 관리 화면에 나타나지 않는다.

**ESLint · ArchUnit 이 리터럴을 막는다** — [ADR-0020](./0020-path-prefix-action-and-seed-generation.md) 이 `endpoints` 상수에 대해
*"URL 문자열 리터럴을 금지하고 상수만 쓰게 한다"* 고 한 것과 **같은 장치**다. 그러면
**선언 = 사용**이 구조적으로 보장되고, 상수 목록이 곧 *"누가 이 키를 쓰는가"* 가 된다.

### 2. `generateMessageSeed` 가 양쪽을 스캔한다 — **행은 추가만, 사용처는 전건 재계산**

```
./gradlew generateMessageSeed
```

| 입력 | 어디서 | 무엇을 |
|---|---|---|
| 키 | **프론트 `MSG`** + **백엔드 `MsgKey`** | 키의 존재 |
| **`USE_SCOPE`** | 어느 쪽에 있나 | **사용처** — §4 |
| 설명 | 백엔드는 **필드 Javadoc**, 프론트는 **JSDoc** | 관리 화면의 보조 설명(선택) |

```
프론트 shared/i18n/messageKeys.ts   ─┐
백엔드 core MsgKey                   ─┴→ generateMessageSeed → 008-init-message-key.yaml
```

**여기가 [ADR-0022](./0022-generated-seed-full-sync.md) 와 갈리는 자리다.**

| | `006-init-api`([ADR-0022](./0022-generated-seed-full-sync.md)) | **`008-init-message-key`** |
|---|---|---|
| 행 | **전건 삭제 → 전건 삽입** | **없는 것만 추가**(`loadUpdateData`, PK 지정) |
| 코드에서 사라진 것 | **데이터에서도 사라진다** | **남는다** — `USE_SCOPE='NONE'` 으로 표시만 한다 |
| 왜 | 그 행에 **사람의 것이 없다** | **번역이 딸려 있다.** 지우면 사람이 쓴 것이 사라진다 |
| `USE_SCOPE` 컬럼 | — | **전건 재계산** — 그것이 죽은 키 판정의 **유일한 경로**다 |

***"추가만 한다"* 는 행에 대한 말이고 `USE_SCOPE` 는 매번 다시 쓴다.** 그 구분이 이
결정의 핵심이다 — 행을 지우지 않으면서도 *"이 키는 이제 아무도 안 쓴다"* 를 알 수 있다.

> **그래서 입력이 하나 더 있다 — 직전 시드 파일이다.** 소스에서 사라진 키는 소스 스캔으로
> 알 수 없으므로, `USE_SCOPE='NONE'` 을 쓰려면 **그 키를 아는 곳**이 필요하고 그것이 커밋된
> `008-init-message-key.yaml` 이다. 이 입력을 빼면 재생성이 그 행을 떨어뜨리고, 그러면
> `loadUpdateData` 가 갱신하지 않아 **DB 의 `USE_SCOPE` 가 옛 값으로 굳는다** — 죽은 키가
> 영원히 `미사용` 으로 안 보인다. 구현과 절차는 [33](../../standard/_study/seed-generation.md) §2.2.

`checkMessageSeed` 가 CI 에서 **재생성 결과 == 커밋본**을 비교한다([ADR-0020](./0020-path-prefix-action-and-seed-generation.md) §3 과 같다).
시드가 키와 사용처만 담으므로 비교가 성립한다 — **값은 파일에 없다.**

### 3. 테이블을 둘로 쪼갠다 — **소유가 테이블 경계가 된다**

```
SYS_MESSAGE_KEY(MSG_KEY PK, USE_SCOPE, MSG_DESC, 감사)   ← 코드가 소유. 시드가 쓴다
SYS_MESSAGE(MSG_KEY, LANG_CD PK, MSG_VAL nullable, 감사) ← 사람이 소유. 시드가 안 건드린다
```

**[ADR-0022](./0022-generated-seed-full-sync.md) 의 축(*"누가 소유하는가"*)이 여기서 테이블 분리로 표현된다.** 한 테이블에
두 소유가 섞여 있던 것이 부분 함수 종속의 원인이었고, 쪼개면 그것이 사라진다.

| 쪼개서 함께 사라지는 것 | |
|---|---|
| 부분 함수 종속 | `USE_SCOPE` 가 `MSG_KEY` 테이블에 있다 — PK 에 `LANG_CD` 가 없다 |
| 그룹 수정이 행 N개 | 키 테이블 **한 행**을 고친다 |
| 마스터 행의 실체 | **`SYS_MESSAGE_KEY` 행이 곧 마스터 행**이다 |

**분리의 대가로 걱정했던 둘이 치러지지 않는다**([63](../../../documents/screen/code/requirements.md) §5 의 이전 미결).

| 걱정 | 왜 치르지 않나 |
|---|---|
| **등록이 2단계** | 키는 **시드가 만든다.** 화면에서 만들 때도 `list` 컬럼([54](../../standard/frontend/_study/grid-column-contract.md) §5.6)이 값을 함께 실어 **한 번에 저장**한다 — [53](../../standard/frontend/_study/grid-standard.md) §6.1 의 2단계를 밟지 않는다 |
| **삭제가 2단계** | [53](../../standard/frontend/_study/grid-standard.md) §6.2 의 게이트는 **DB 가 거부할 것을 미리 알리는** 장치다. 삭제 서비스가 **값 → 키 순서로** 지우면 거부되지 않으므로 게이트가 필요 없다. `ON DELETE CASCADE` 를 쓰지 않는 것과 무관하다([42](../../knowledge/sys/menu.md) §5) |

**`MSG_VAL` 을 `NULL` 허용으로 둔다.** 미번역이 *"행이 없다"* 가 아니라 *"값이 비었다"* 가
되어 [63](../../../documents/screen/code/requirements.md) §3 의 화면이 **빈 셀을 그대로 편집**하게 된다. 값 행은 시드가 만들지 않고
**사람이 채울 때 생긴다** — 지원 언어 목록이 **런타임 데이터**(`LANG_CD` 공통코드)이므로
빌드 시점의 시드가 그것을 알 수 없기 때문이다.

### 4. `MSG_GRP_CD` 를 없애고 **번들 여부는 `USE_SCOPE` 에서 파생**한다

| `USE_SCOPE` | 뜻 | 누가 쓰나 | **번들** |
|---|---|---|---|
| **`FRONT`** | 프론트 상수에만 있다 | 시드 | **Y** |
| **`BACK`** | 백엔드 상수에만 있다 | 시드 | N |
| **`BOTH`** | 양쪽에 있다 | 시드 | **Y** |
| **`DATA`** | **데이터가 만드는 키** — `code.*` · `menu.*` | **`CODE_MGMT` · `MENU_TREE`** | **Y** |
| **`NONE`** | 양쪽에서 못 찾았다 — **죽은 키** | 시드 | N |

**번들 = `USE_SCOPE ∈ {FRONT, BOTH, DATA}`** 다. 화면 흐름 §3.2 가 *"프론트가 쓰는 것 전체를
준다"* 고 정했으므로 **경계가 곧 *프론트가 쓰는가*** 이며, 그것이 사용처의 함수다.

- **번들 여부를 컬럼으로 저장하지 않는다** — `USE_SCOPE` 에서 나오므로 두면 **같은 사실의
  원천이 둘**이 된다. [43](../../knowledge/sys/code.md) §4.2 가 `ETC` 컬럼을 거부한 이유와 같다
- **`DATA` 는 시드가 쓰지 않는다.** `code.{GRP_CD}.{DTL_CD}` · `menu.{MENU_CD}` 는 소스 상수가
  아니라 **데이터에서 조립된 키**다([43](../../knowledge/sys/code.md) §4.4) — 그 행은 `CODE_MGMT`([63](../../../documents/screen/code/requirements.md) §2.3)와
  메뉴 저장이 만들고, **`generateMessageSeed` 는 두 접두를 건드리지 않는다**
- **이 예외를 잊으면 `code.*` · `menu.*` 전부가 죽은 키로 잡힌다.** 접두 목록이 곧
  *"데이터가 키를 만드는 자리"* 의 전부이며 [43](../../knowledge/sys/code.md) §3 의 명칭 규칙이 그것을 이미 닫아 뒀다

## 기각한 대안

| 기각 | 이유 |
|---|---|
| **`MSG_GRP_CD` 를 유지하고 번들 집합만 코드에 둔다** | 한 컬럼이 **분류와 경계 둘**을 진다. 관리자가 그룹을 추가하면 코드가 모르는 값이 생기고, 그것을 `미분류` 로 표시하는 것은 **증상을 보이게 한 것이지 해결이 아니다**([63](../../../documents/screen/code/requirements.md) §3.4 의 이전 판) |
| **전건 동기화**([ADR-0022](./0022-generated-seed-full-sync.md) 처럼) | **번역이 사라진다.** 키 리터럴 하나를 잠시 지운 커밋이 배포되면 그 키의 전 언어 값이 날아가고, 되돌릴 방법이 시드에 없다 |
| **키 하드코딩을 유지하고 죽은 키는 그랩으로 찾는다** | 사람이 주기적으로 해야 하고 **잊으면 조용하다.** 원칙 P1 이 요구하는 *"장치화"* 가 아니다. [ADR-0020](./0020-path-prefix-action-and-seed-generation.md) 이 API 에 대해 같은 대안을 기각했다 |
| **번들 여부를 별도 컬럼으로 저장** | `USE_SCOPE` 의 함수다. 둘을 두면 어긋날 수 있고 *"어느 쪽이 맞나"* 를 판정할 근거가 없다 |
| **테이블을 안 쪼개고 `USE_SCOPE` 를 `SYS_MESSAGE` 에 둔다** | `MSG_GRP_CD` 의 **부분 함수 종속을 이름만 바꿔 되살리는 것**이다. 같은 키의 두 언어 행이 다른 사용처를 가질 수 있게 된다 |
| **관리 화면에서 키 추가를 금지** | 번역을 **엑셀로 먼저 넣는** 정상 경로가 있다([63](../../../documents/screen/code/requirements.md) §3.6). 막는 대신 `미사용` 배지로 드러낸다 — [ADR-0020](./0020-path-prefix-action-and-seed-generation.md) 이 미매핑을 막지 않은 것과 같다 |

## 결과

- **죽은 키가 화면에서 보인다.** [42](../../knowledge/sys/menu.md) §5 가 API 에 대해 *미등록* 과 *미매핑* 을 가른 것처럼,
  메시지는 **`FRONT`·`BACK`·`BOTH`·`DATA`·`NONE`** 다섯으로 갈린다. `NONE` 은 [63](../../../documents/screen/code/requirements.md) §3.4 의
  **`미사용` 배지**이고 고치는 곳은 *"지우거나, 쓰기 시작하거나"* 다
- **`미분류` 배지가 사라진다.** 관리자가 그룹을 추가해서 생기던 상태가 **개념째로 없어진다**
- **[63](../../../documents/screen/code/requirements.md) §5 의 미결 셋이 함께 해소된다** — 부분 함수 종속 · 마스터 행의 실체 · 그룹 수정의 N행
- **화면 흐름 §3.2 의 *"경계는 `MSG_GRP_CD` 다"* 가 개정된다** — 경계는 `SYS_MESSAGE_KEY.USE_SCOPE` 다
- **시드 번호 충돌이 정리된다.** [22](../../standard/backend/_study/db-portability.md) §1 의 그림에 있던 `003-init-message` 는 `006-init-api`
  ([ADR-0020](./0020-path-prefix-action-and-seed-generation.md))와 번호를 다투고 있었다. 이제 **`008-init-message-key`(생성물)** 이며,
  ~~손으로 쓰는 메시지 시드는 **없어진다** — 값은 화면과 엑셀이 넣는다~~

  > **정정 (2026-08-29 — 구현).** 저 문장은 **키**에 대한 것이었고 **설치 직후의 값**을 다루지
  > 않았다. 값 시드가 없으면 갓 설치한 템플릿이 화면 전체를 `menu.SYSTEM` 처럼 키로 보여주고,
  > **`MESSAGE_MGMT` 조차 그 상태라 고칠 수도 없다** — *"키를 그대로 보인다"*([43](../../knowledge/sys/code.md) §7.3)는
  > **운영 중 빠뜨림**을 드러내는 장치이지 설치 직후의 정상 상태가 아니다.
  >
  > 그래서 **`009-init-message`(사람 소유)** 를 둔다. `002-init-admin` 과 같은 성격이며
  > 생성 태스크가 열지 않는다. 여기에는 `menu.*` **키 행**도 함께 들어간다 — 데이터가 만드는
  > 키라 생성 시드가 건드리지 않고([43](../../knowledge/sys/code.md) §4.4), 시드 메뉴 24개의 이름을 누군가는
  > 만들어야 하기 때문이다. 앞으로 추가되는 메뉴의 키 행은 메뉴 저장 화면이 만든다.
- **`loadUpdateData` 가 추상 명령 목록에 들어온다**([22](../../standard/backend/_study/db-portability.md) §1). `delete`·`insert` 와 같은
  Liquibase 표준이며 PK 를 지정해 upsert 한다 — **CSV 에 담은 컬럼만 갱신**하므로
  `MSG_VAL` 을 건드리지 않는다
- **죽은 키를 CI 경고로 올릴지는 미결**이다([63](../../../documents/screen/code/requirements.md) §5) — [62](../../../documents/screen/menu/requirements.md) §6 이 미매핑에 대해 남긴
  것과 **같은 성격**이고, 배포 예정 화면의 키가 먼저 들어오는 정상 경로가 있어 오탐이 난다
