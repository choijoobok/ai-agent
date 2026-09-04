# ADR-0004. Ant Design + AG Grid Community

- 상태: 채택
- 일자: 2026-08-22

## 맥락
백오피스 UI 라이브러리와 데이터 그리드 선택. 유료 라이선스는 배제한다.

## 결정
UI 는 **Ant Design 6**, 데이터 그리드는 **AG Grid Community 36** (MIT).
antd `Table` 은 사용하지 않고 그리드는 AG Grid 로 통일한다.
AG Grid Enterprise 기능은 필요 시 직접 구현한다.

## 근거
- antd 는 폼·모달·트리·날짜 등 백오피스에 필요한 컴포넌트가 완비되어 있고 한국어 리소스가 좋다.
- AG Grid Community 는 MIT 라이선스이면서 가상 스크롤·편집·필터 등 핵심 기능을 제공한다.
- Enterprise 기능 중 실제로 필요한 것(엑셀 export, 서버 페이징)은 서버에서 처리하는 편이
  오히려 대용량에 유리하다. 엑셀은 Apache POI 로 서버 생성한다.

## 대안
| 대안 | 기각 사유 |
|---|---|
| antd Table 단독 | 대용량 가상 스크롤·복잡한 그리드 요구에 한계 |
| MUI + MUI X DataGrid | DataGrid Pro 가 유료 |
| TanStack Table + 직접 구현 | 자유도는 높으나 템플릿 초기 구축 비용 과다 |
| antd Table + AG Grid 혼용 | 두 그리드 공존은 일관성·학습비용 문제 |

## 결과
- antd(CSS 변수)와 AG Grid(Theming API) 의 테마를 잇는 **토큰 어댑터**를 만들어야 한다.
- AG Grid 를 `<DataGrid>` 로 감싸 교체 가능성을 남긴다 — **판(Community/Enterprise) 교체까지**
  포함한다([ADR-0018](./0018-grid-edition-agnostic-vocabulary.md), 2026-08-25 확장).
- **엑셀 서버 생성은 임의 API 경로에 한정된다**([ADR-0019](./0019-excel-download-three-paths.md), 2026-08-25 개정) — 그리드
  현재 페이지·전체는 프론트에서 `exceljs` 로 만든다.
- `@ant-design/icons` 는 antd 와 메이저 버전을 반드시 일치시킨다.
