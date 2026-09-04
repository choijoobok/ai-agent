# ADR-0018. 그리드 어휘를 우리가 갖는다 — AG Grid 판 교체를 화면 밖으로

- 상태: 채택
- 일자: 2026-08-25
- 관련: [ADR-0004](./0004-antd-with-ag-grid.md) · [24-frontend-stack](../../standard/frontend/_study/frontend-stack.md) §6·§7 · [10-feature-inventory](../../knowledge/features.md) UX-06·UX-13·UX-15

## 맥락

[ADR-0004](./0004-antd-with-ag-grid.md) 가 AG Grid **Community(MIT)** 를 택하고 *"Enterprise 기능은 필요 시 직접 구현"* 으로
두었다. 그런데 이 템플릿을 쓰는 조직이 **Enterprise 라이선스를 살 수도 있다.**

그때 화면 소스를 고쳐야 한다면 템플릿의 가치가 크게 준다 — 화면이 수백 개인 시점에
라이선스를 사는 것이 곧 대규모 리팩터링이 된다. 반대로 Community 로 시작한 조직은
Enterprise 기능을 흉내 낸 자체 구현을 영구히 안고 가야 한다.

**두 판이 같은 화면 소스로 동작해야 한다.**

## 결정

**컬럼·필터·에디터를 지시하는 어휘를 우리가 정의한다.** 화면은 그 어휘만 쓰고, AG Grid
`colDef` 로의 변환은 **어댑터**가 한다. 판 전환은 어댑터를 갈아 끼우는 일이며 화면 소스는
바뀌지 않는다.

```
화면            <DataGrid columns={[{ field:'stateCd', filter:'set', editor:'richSelect' }]} />
                                    ^ 우리 어휘. ag-grid 를 모른다
어댑터          community/  -> 자체 구현 필터·에디터
                enterprise/ -> agSetColumnFilter · agRichSelectCellEditor
AG Grid         colDef
```

[24](../../standard/frontend/_study/frontend-stack.md) §6 이 이미 `<DataGrid>` 래퍼를 *"프로젝트가 그리드를 교체할 여지"* 로 두었다.
이 문서는 그 교체 축에 **같은 그리드의 다른 판**을 더한다 — 실제로 일어날 가능성이 훨씬 높은
교체다.

### 어휘가 덮는 것

| 우리 어휘 | Community 구현 | Enterprise 위임 |
|---|---|---|
| `filter: 'set'` | **자체 체크박스 목록 필터** | `agSetColumnFilter` |
| `filter: 'text' \| 'number'` | 내장 | 같음 |
| **`filter: 'date'`** | **AntD 달력으로 교체** — 범위 · 정밀도 셋([54](../../standard/frontend/_study/grid-column-contract.md) §4.5) | **같음** — 검색 폼과 모양이 같아야 한다 |
| `editor: 'richSelect'` | **자체 검색 콤보** | `agRichSelectCellEditor` |
| **`editor: 'popupRef'`** | **자체 구현** — 팝업에서 골라 여러 컬럼을 채운다([54](../../standard/frontend/_study/grid-column-contract.md) §6) | **없다 — 양쪽 다 자체 구현** |
| **`editor: 'switch'`** | **자체 구현** — `ynFlag` 는 체크박스가 아니다([54](../../standard/frontend/_study/grid-column-contract.md) §5.2) | 〃 |
| **`renderer` 여섯** | **자체 구현** — `badge` · `tags` · `link` · `progress` · `icon` | `sparkline` 만 위임 가능 |
| **긴 텍스트 에디터** | **자체 구현** — `textModal` · `richText`([54](../../standard/frontend/_study/grid-column-contract.md) §5.5) | **없다 — 양쪽 다 자체 구현** |
| **`type: 'list'`** | **자체 구현** — 배열을 담는 셀([54](../../standard/frontend/_study/grid-column-contract.md) §5.6) | 〃 |
| `editor: 'text' \| 'number' \| 'date' \| 'checkbox' \| 'largeText' \| 'select'` | 내장 | 같음 |
| 컬럼 표시·순서·너비 패널 | **UX-06 자체 구현** (순서·표시는 DB) | Tool Panel 로 대체 가능 |
| 행 우클릭 메뉴 | **antd `Dropdown`** | Context Menu |
| 셀 범위 선택·복사 | **자체** (필요 시) | Range Selection · Clipboard |
| 선택 건수 표시 | **자체** | Status Bar |

**UX-06 은 이미 자체 구현이 확정돼 있다** — 순서·표시여부는 DB, 너비는 `localStorage`
([41](../../knowledge/sys/user-role.md) §4.3). Enterprise 의 Tool Panel 은 이 저장 정책을 갖지 않으므로, 판을 바꿔도
**자체 구현을 유지하는 편이 낫다.** 어휘가 같으므로 선택은 어댑터의 문제다.

### 엑셀은 예외 — 판을 바꿔도 Enterprise Export 를 쓰지 않는다

엑셀 다운로드는 **세 갈래**이며([ADR-0019](./0019-excel-download-three-paths.md)) 어느 것도 AG Grid 기능이 아니다.

| 경로 | 생성 |
|---|---|
| 현재 페이지 · 전체 | **프론트** (`exceljs`) |
| 임의 API | **서버** (POI) |

Enterprise 의 Excel Export 는 **그리드가 가진 것만** 내보내므로 임의 API 경로를 대신할 수
없고, 프론트 생성 경로는 `exceljs` 로 이미 충족된다. 판을 바꿔도 이 셋이 그대로이므로
`<ExcelDownloadButton>` 은 어댑터의 대상이 아니다.

## 범위 밖 — 트리 · 피벗 · 행 그룹핑

| 기능 | 왜 어휘로 감싸지 않는가 |
|---|---|
| Tree Data | 데이터 형태 자체가 계층이다. 평면 행을 전제한 어휘로 덮을 표면이 아니다 |
| Pivoting | 컬럼이 데이터에서 생성된다. `columns` 를 화면이 선언하는 전제가 깨진다 |
| Row Grouping · Aggregation | 접었다 펴는 표시 구조가 트리와 같다. 여기까지 덮으면 어댑터가 그리드를 다시 만드는 일이 된다 |

**Enterprise 를 산 조직이 이 셋을 쓰려면 그 화면만 AG Grid API 를 직접 쓴다.** 어휘의
경계를 넘는 것을 막지 않되, **넘는 순간을 눈에 보이게** 한다 — 그 화면은 어댑터를 거치지
않으므로 판 교체 시 손봐야 하는 목록에 스스로 들어간다.

## 어떻게 보장하나

| 장치 | 내용 |
|---|---|
| **화면에서 `ag-grid` import 금지** | ESLint 규칙으로 강제한다([24](../../standard/frontend/_study/frontend-stack.md) §4.6 의 골든 레퍼런스 방식) |
| 어댑터만 AG Grid 를 안다 | `shared/grid/` 밖에서 `colDef`·`GridApi` 타입이 보이면 규칙 위반이다 |
| **빌드 타임 분기** | Community 배포에 Enterprise 코드가 섞이면 라이선스 워터마크가 뜬다. 번들에 들어가지 않아야 한다 |
| 어휘 테스트 | 같은 `columns` 선언이 두 어댑터에서 같은 동작을 내는지 확인한다 — 판별 기준이 문서가 아니라 테스트다 |

**런타임 설정으로 판을 고르지 않는다.** Enterprise 모듈을 번들에 넣고 설정으로 끄면
Community 배포도 그 코드를 내려받고, 라이선스 키가 없으면 콘솔 경고와 워터마크가 나온다.
[23](../../standard/backend/_study/security-design.md) §2 가 세션 스토어를 `store-type` 으로 고른 것과 다른 이유다 — 그쪽은 서버이고
번들 크기와 라이선스 표시가 없다.

## 결과

- **Phase 6(공통 컴포넌트 설계)이 이 어휘를 정의하는 단계가 된다.** 어휘가 없으면 화면을
  만들 수 없으므로, 샘플 화면 설계(48)와 구현(Phase 8)은 그 뒤로 간다
- ~~자체 구현이 필요한 것은 **Set Filter 와 검색 콤보 둘**이다~~ → **개정(2026-08-27).**
  그리드 요건이 구체화되면서 **열**이 됐다 — Set Filter · 검색 콤보 · **팝업 참조 에디터** ·
  **날짜+시분초 범위 필터** · 컬럼 설정 패널 · **행 상태·삭제 컬럼·일괄 저장** ·
  **검증 프레임워크** · **편집 전 판단과 거부 메시지** · **`switch` 에디터** ·
  **셀 렌더러 여섯** · **긴 텍스트 에디터** · **`listModal`**. 목록과 근거는 [54](../../standard/frontend/_study/grid-column-contract.md) §7.2
- **Enterprise 를 사도 일곱은 남는다** — 컬럼 설정 패널(저장 정책이 다르다) · 행 상태 ·
  검증 · 편집 전 판단 · `switch` · 긴 텍스트 모달 · `listModal` 은 AG Grid 에 대응이 없다. **판을 바꿔 없어지는
  것은 Set Filter · 검색 콤보 · 날짜+시분초 필터 · `sparkline` 넷뿐**이며, 그래서 어댑터
  경계가 여전히 값을 한다
- **어휘는 AG Grid 기능의 부분집합이다.** 이것이 이 결정의 대가다 — Enterprise 를 산 조직이
  모든 기능을 쓰려면 어휘를 넓히거나 그 화면에서 경계를 넘는다

## 기각한 대안

| 대안 | 기각 사유 |
|---|---|
| Community 만 지원한다 | 라이선스를 산 조직이 얻는 것이 없다. 템플릿이 상한을 정하는 셈이다 |
| Enterprise 를 기본으로 요구한다 | 유료 라이선스 배제가 [ADR-0004](./0004-antd-with-ag-grid.md) 의 전제다 |
| `colDef` 를 화면이 직접 쓰고 판별 분기를 화면에 둔다 | 분기가 화면 수만큼 늘어난다. 판을 바꾸는 것이 전수 수정이 된다 |
| 런타임 설정으로 판 전환 | Community 배포가 Enterprise 코드를 내려받고 워터마크가 뜬다 — 위 |
| 그리드를 완전 자체 구현 | [ADR-0004](./0004-antd-with-ag-grid.md) 가 TanStack + 직접 구현을 이미 기각했다(초기 구축 비용) |
