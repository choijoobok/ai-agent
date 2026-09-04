# ADR-0027. 프론트가 만드는 엑셀의 `EXPORT` 는 메뉴가 선언한다

- 상태: 채택
- 일자: 2026-08-30
- 관련: [ADR-0019](./0019-excel-download-three-paths.md) · [ADR-0020](./0020-path-prefix-action-and-seed-generation.md) · [ADR-0022](./0022-generated-seed-full-sync.md) · [23-security-design](../../standard/backend/_study/security-design.md) §4 · [42-data-model-authz](../../knowledge/sys/menu.md) §4·§5 · [52-menu-inventory](../../knowledge/sys/menu.md) §4.2 · [61-screen-user](../../../documents/screen/user/requirements.md) §4.4 · [62-screen-menu](../../../documents/screen/menu/requirements.md) §2.4

## 맥락

[ADR-0020](./0020-path-prefix-action-and-seed-generation.md) 이 액션의 원천을 하나로 못박았다 — **`ACTION_CD` 는 API 의 속성**이고,
어떤 메뉴가 어떤 액션을 가질 수 있는가는 `SYS_MENU_API ⋈ SYS_API` 가 말한다.
[61](../../../documents/screen/user/requirements.md) §4.4 가 그것을 화면의 어휘로 옮겨 놓았다 — *"`—` 는 안 줬다가 아니라 줄 것이 없다"*,
그리고 *"액션 열은 화면의 성질이 아니라 그 화면에 매핑된 API 들의 성질"*.

**`EXPORT` 에서 그 문장이 성립하지 않는다.**

[ADR-0019](./0019-excel-download-three-paths.md) 가 엑셀을 세 갈래로 갈랐고 그중 **둘(현재 페이지 · 전체)을 프론트 생성**으로
정했다. 프론트 생성에는 **서버 호출이 없다.** 호출이 없으면 컨트롤러가 없고, 컨트롤러가
없으면 `SYS_API` 행이 없다 — 그래서 `export` 접두 규칙은 **한 번도 발동한 적이 없다.**

```
006-init-api.csv 의 EXPORT 행 : 0
004-init-role.yaml 의 EXPORT 부여 : 10
```

**둘이 만나지 못했다.** [52](../../knowledge/sys/menu.md) §4.2 의 액션 열은 `E` 를 열 개 메뉴에 주었고 004 는 그대로
부여했는데, 정의 쪽에서는 그 열 개가 전부 미정의였다. 결과가 역할 권한 화면에서 실물로
드러났다(2026-08-30).

| | |
|---|---|
| 트리 | `EXPORT` 열이 **모든 메뉴에서 `—`** 다 — 새 역할에 출력 권한을 줄 수단이 없다 |
| 004 가 준 부여 | **고아**로 보인다. 그리고 [ADR-0022](./0022-generated-seed-full-sync.md) 에 따라 *정의 밖은 건드리지 않으므로* **회수할 수단도 없다** |
| 화면 | 그 부여가 살아 있어 **버튼은 보인다** — 데이터는 못 만지는데 결과는 정상으로 보인다 |

마지막 줄이 이 결함의 얼굴이다. **아무도 불편하지 않았다** — 시드 관리자에게는 이미
부여돼 있었으므로. 두 번째 역할을 만들 때 처음 드러난다.

## 결정

**액션의 원천을 둘로 연다. 다만 두 번째 원천은 `EXPORT` 하나에만 열린다.**

```
정의된 액션 = 매핑된 API 가 말하는 액션  ∪  화면이 스스로 하는 액션
              SYS_MENU_API ⋈ SYS_API        SYS_MENU.EXPORT_YN
```

### 1. `SYS_MENU.EXPORT_YN` — 메뉴가 선언한다

`CHAR(1)` · 기본값 `'N'`([42](../../knowledge/sys/menu.md) §4). *"이 화면은 엑셀을 낸다"* 이며, **부여가 아니라
정의**다 — 켜져 있다고 누가 가진 것이 아니라, 켜져 있어야 **줄 수 있다.**

- **값은 [52](../../knowledge/sys/menu.md) §4.2 의 액션 열 `E` 를 그대로 옮긴 것**이다. 003 은 이미 적용된
  changeset 이라 손대지 않고 `056-menu-export.yaml` 이 채운다 — 035 가 003 이 비워 둔
  `ICON_CD` 를 채운 것과 같은 자리다([22](../../standard/backend/_study/db-portability.md) §1.1)
- **저장 DTO 에 두지 않는다.** 엑셀 버튼이 화면에 있는가는 개발 시점에 정해진 사실이고,
  운영에서 켤 수 있으면 *버튼 없는 화면에 출력 권한* 이 생긴다 — 매핑을 시드로만 바꾸는
  이유와 같다([23](../../standard/backend/_study/security-design.md) §4 · 원칙 P1)
- **새 메뉴는 `'N'` 에서 시작한다**(`SysMenu.created`). 관리 화면이 만든 노드가 곧바로
  출력 권한을 갖지 않는다

### 2. `READ` 가 없는 메뉴에는 붙이지 않는다

`MenuActionCatalog` 가 `EXPORT` 를 더하는 것은 **그 메뉴에 `READ` 가 정의돼 있을 때뿐**이다.

엑셀은 **조회한 것을 내려받는 일**이라 `READ` 없이는 성립하지 않으며, [61](../../../documents/screen/user/requirements.md) §4.4 의
불변식이 이미 그렇게 말한다 — `READ` 없이 `EXPORT` 만 담긴 저장은 서버가 거부한다.
그 검사를 그대로 두고 스위치만 그리면 **켤 수는 있는데 저장이 안 되는 칸**이 생긴다.

걸리는 것은 **아직 화면이 없는 메뉴**다. `E` 를 가진 열 개 중 넷(`USER_MGMT` ·
`USER_AUTH_MGMT` · `BATCH_HISTORY` · `ERROR_LOG`)은 매핑된 API 가 하나도 없어 004 의
`READ` 부여마저 고아인 상태이며, **그 화면이 서면 넷이 함께 살아난다.** 구조 노드가
걸러지는 것도 여기서 함께 끝난다 — 007 은 리프에만 API 를 매핑한다.

### 3. 계산을 한 자리로 모은다 — `MenuActionCatalog`

같은 사실을 트리 조회(`RoleQueryService`)와 권한 저장(`RoleAuthService`)이 각자
읽고 있었다. 원천이 하나일 때는 같은 쿼리 두 벌이었지만 **합집합이 되는 순간 규칙**이
되며, 규칙이 두 곳에 있으면 한쪽만 고쳐진다 — 그때 증상은 *트리에는 스위치가 있는데
저장이 거부한다* 이다.

**둘이 각자 부르는 것은 그대로 둔다.** 조회와 저장이 같은 트랜잭션이 아니므로 그 사이에
시드가 재생성되면 화면이 켠 칸이 저장에서 거부될 수 있고, **그것이 맞는 동작**이다.

## `EXPORT` 는 서버가 집행하지 않는다 — 그래서 **운영 정책**이다

이 ADR 이 반드시 함께 적어야 하는 사실이다.

부를 API 가 없다는 말은 **인가 인터셉터가 막을 요청도 없다**는 뜻이다(`ApiAuthorityRegistry`
는 URL 로만 판정한다). `EXPORT` 를 실제로 집행하는 것은 **버튼을 그릴지 말지를 정하는
프론트**뿐이다.

| | |
|---|---|
| 실제 경계 | **`READ`** — 조회할 수 있는 사람은 화면에 뜬 것을 어떻게든 옮겨 적을 수 있다 |
| `EXPORT` 가 하는 일 | *"이 사람에게 내려받기를 허용했는가"* 를 **데이터로 남긴다** |
| 짝이 되는 것 | 다운로드 기록([ADR-0019](./0019-excel-download-three-paths.md) — 프론트 생성도 `SYS_LO_ACCESS` 에 알린다) |

**유출을 막는 장치로 읽으면 안 된다.** 정한 대로 운영되고 있는가를 묻는 장치이며, 그
값은 감사와 짝을 이룰 때 나온다. 진짜 봉쇄가 필요하면 `READ` 를 주지 않는 것이 답이다.

## 잊는 것은 시드 테스트가 막는다

`SeedBootstrapAuthorityTest` 에 검사 둘이 는다.

| 검사 | 막는 것 |
|---|---|
| **`EXPORT` 부여는 `EXPORT_YN='Y'` 인 메뉴에만** | 이 ADR 이 고친 결함 그 자체 — 정의 없는 부여는 **회수할 수 없는 고아**가 된다 |
| **`EXPORT_YN` 은 리프에만** | 구조 노드에 켜지면 트리가 폴더에 스위치를 그리고, 저장은 `MENU_URL IS NULL` 로 거부한다 |

[ADR-0020](./0020-path-prefix-action-and-seed-generation.md) 이 *"잊는 문제는 생성이 아니라 **검증**을 자동화해 푼다"* 고 한 그대로다.
여기서 생성을 택하지 않은 이유는 아래에 있다.

## 기각한 대안

| 기각 | 이유 |
|---|---|
| **`EXPORT` 를 조건 없이 켜고 끌 수 있게 한다** | 사용자가 처음 물은 형태다. `CONFIG_MGMT` · `ROLE_MGMT` · `ROLE_AUTH_MGMT` 에 출력 권한이 생기는데, [52](../../knowledge/sys/menu.md) §4.2 는 그 셋에 `E` 를 주지 않았다 — **설정값과 인가 정의는 내려받아 돌려 보는 업무 데이터가 아니다.** 정의를 없애는 것은 결정을 없애는 것이지 여는 것이 아니다 |
| **`READ` 가 있으면 자동으로 `EXPORT` 도 정의된 것으로 본다** | 위와 같은 결과다. `DataGrid` 가 조회 API 를 가진 모든 그리드에 엑셀 버튼을 그리므로 *구현이 이미 그렇다* 는 말은 맞지만, **그것이 [52](../../knowledge/sys/menu.md) §4.2 가 내린 결정과 어긋난다는 것이 이 결함의 다른 절반**이다 |
| **프론트에 선언한다**(`endpoints.ts` 옆 · `screenRegistry.ts`) | [ADR-0020](./0020-path-prefix-action-and-seed-generation.md) 의 사슬은 **셋 다 화면이 돌기 위해 이미 있어야 하는 것**이라 *선언 = 사용* 이 성립했다. 엑셀 버튼에는 그런 마디가 없어 **새 선언을 만들어야 하는데**, 그러면 접근 범위 확장이 **시드 diff 밖으로 나간다** — 리뷰어가 *"이 화면이 데이터를 내려받게 하는 것이 맞는가"* 를 볼 자리가 사라진다. `endpoints.ts` 는 **폴더당 하나**라 한 폴더에 메뉴가 둘이면 함께 켜지는 문제도 있다 |
| **`SYS_MENU_ACTION` 테이블을 새로 만든다** | 담을 것이 `EXPORT` 하나이고 행이 열이다. 004-authz 가 *"쓰지 않는 DDL 을 미리 넣으면 됐다 로 보이는데 한 번도 돌아 본 적이 없다"* 고 적어 둔 그대로이며, 두 번째 클라이언트 전용 액션이 실제로 생기면 그때 옮긴다 |
| **`SYS_API` 에 가짜 URL 행을 넣는다**(`client:excel` 류) | 어떤 요청도 매칭될 수 없는 **불활성 행**이라 인가에는 무해하지만, `SYS_API` 는 *"이 URL 은 이 액션이다"* 라는 뜻이고 API 카탈로그([62](../../../documents/screen/menu/requirements.md) §5)가 그것을 사람에게 보여준다 — **없는 API 를 있다고 말하게 된다** |
| **`generateApiSeed` 가 만들게 한다** | 읽을 원천이 없다. 만들면 그 원천이 곧 위의 *프론트 선언* 이다 |
| **엑셀 생성용 서버 API 를 만든다** | [ADR-0019](./0019-excel-download-three-paths.md) 를 되돌리는 것이다. 이미 브라우저에 있는 데이터를 다시 받게 되고, 마스킹이 자동으로 지켜지던 것도 깨진다 |

## 결과

- **[ADR-0020](./0020-path-prefix-action-and-seed-generation.md) 의 *"액션은 API 의 속성"* 이 셋으로 좁혀진다** — `READ` · `SAVE` · `EXECUTE`.
  `EXPORT` 는 API 가 있으면 API 가 말하고(`export` 접두는 살아 있다 — 임의 API 경로가
  그것을 쓴다), **없으면 메뉴가 말한다**
- **[61](../../../documents/screen/user/requirements.md) §4.4 의 *"액션 열은 매핑된 API 들의 성질"* 에 예외가 하나 생긴다.** 같은 절의
  `ROLE_MGMT` 예시 표는 그대로다 — 거기 적힌 값이 [52](../../knowledge/sys/menu.md) §4.2 였고, 이 결정은
  **데이터를 그 표에 맞춘 것**이다
- 역할 권한 화면에서 **출력 권한을 새 역할에 줄 수 있게 된다.** 004 의 부여 열 건도
  고아를 벗어나 **회수할 수 있게 된다**
- **`EXPORT` 가 봉쇄가 아니라는 사실이 문서에 남는다.** 지금까지 아무 데도 적혀 있지
  않았고, 적혀 있지 않으면 다음 사람이 그것을 봉쇄로 읽는다
- 새 메뉴에 출력 권한을 주려면 **시드가 하나 더 필요하다.** 화면을 만들고 endpoints 를
  선언하면 나머지 셋은 따라오지만 `EXPORT` 만은 따라오지 않는다 — [33](../../standard/_study/seed-generation.md) 의 절차에
  단계가 하나 는다
