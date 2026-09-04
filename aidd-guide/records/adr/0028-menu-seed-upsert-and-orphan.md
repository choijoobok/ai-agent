# ADR-0028. 메뉴 시드는 **생성물이되 지우지 않는다** — upsert + 고아 표시

- 상태: 채택
- 일자: 2026-09-01
- 관련: [ADR-0020](./0020-path-prefix-action-and-seed-generation.md) · [ADR-0022](./0022-generated-seed-full-sync.md) · [ADR-0023](./0023-message-key-sync-from-source.md) · [33-seed-generation-guide](../../standard/_study/seed-generation.md) · [42-data-model-authz](../../knowledge/sys/menu.md) §4·§9 · [52-menu-inventory](../../knowledge/sys/menu.md) · [62-screen-menu](../../../documents/screen/menu/requirements.md) §4.8

## 맥락

[ADR-0022](./0022-generated-seed-full-sync.md) 가 시드를 셋으로 가르며 **메뉴를 *사람 소유 · 누적*** 에 넣었다. 근거는 한
문장이었다 — *"운영에서 화면으로도 고친다(`MENU_TREE`). 전건 삭제하면 운영자가 고친 것을
배포가 지운다."*

**그 문장은 참이지만, 그것이 *누적* 을 요구하지는 않는다.** 그리고 누적은 개발 협업에서
셋을 깬다.

### 개발 협업이 요구하는 것 셋

| 요구 | 누적 모델에서 |
|---|---|
| **여러 개발자가 동시에 메뉴를 더하고 고치고 지워도 머지된다** | ❌ 파일은 안 부딪히지만 **master 의 `include` 목록이 부딪힌다**(지금 102줄). 번호를 손으로 매겨 **실행 순서가 파일명 알파벳순**이 되고, 메뉴 하나 고치는 데 changeset 파일이 하나 는다 |
| **pull 후 로컬에서 그냥 뜬다** | ❌ **브랜치를 바꾸면 깨진다.** 옛 브랜치의 changeset 이 로컬 DB 에 적용된 뒤 되돌아오면 파일은 사라져도 **데이터는 남는다** — Liquibase 는 되돌리지 않는다. 그리고 이미 적용된 changeset 을 고치면 **남의 로컬이 checksum 으로 기동 실패**한다 |
| **배포에 별도 DB 작업이 없다** | ⚠️ 되지만, 개발 중 쌓인 *추가→수정→삭제* 히스토리를 **신규 설치가 전부 재생**한다 |

**대조군이 이미 저장소 안에 있다 — `SYS_API`(006).** 파일 하나(정렬된 CSV) · `runOnChange` ·
전건 재작성이라 셋을 다 만족한다. 충돌해도 **재생성으로 풀리고**, 브랜치를 바꿔도 다음
기동에서 **소스와 정확히 일치**하며, checksum 문제가 없다.

### 그런데 메뉴에 그 모델을 그대로 쓸 수는 없다

**메뉴 행에는 사람의 것이 딸려 있다.** 둘로 갈린다.

| 딸린 것 | 무엇 |
|---|---|
| **행 안** | `SORT_NO`(드래그 — [62](../../../documents/screen/menu/requirements.md) §4.5) · `ICON_CD` · `USE_YN`([62](../../../documents/screen/menu/requirements.md) §4.7) |
| **행 밖** | `SYS_ROLE_MENU_AUTH` · `SYS_USER_MENU_AUTH`(**운영자가 부여**) · `SYS_USER_FAVORITE` · `SYS_USER_SEARCH_COND` · `SYS_USER_GRID_PREF`(**사용자 것**) |

**FK 는 전부 기본값(`RESTRICT`)이다** — 저장소에 `onDelete` 선언이 하나도 없다. 그래서
전건 삭제는 **배포를 FK 위반으로 터뜨린다.** `CASCADE` 로 바꾸면 더 나쁘다 —
[ADR-0022](./0022-generated-seed-full-sync.md) §3 이 *"리팩터링이 권한을 소리 없이 지운다"* 며 금지한 그것이 된다.

> **[62](../../../documents/screen/menu/requirements.md) §4.8 이 이미 답을 갖고 있었다.** *"메뉴를 지우는 것은 화면을 지우는 것이다.
> 순서는 엔드포인트 선언 제거 → 시드 재생성 → 배포 → **메뉴 삭제**"* — 마지막 단계는
> **사람이 화면에서** 하는 일이다. 시드가 그것을 앞질러 지우면 그 게이트가 장식이 된다.

## 결정

**메뉴 시드를 생성물로 옮기되, `SYS_API` 칸이 아니라 [ADR-0023](./0023-message-key-sync-from-source.md) 의 `SYS_MESSAGE_KEY` 칸에
넣는다 — upsert 하고 지우지 않으며, 사라진 것은 표시한다.**

### 1. 원본은 사람이 쓰는 선언 파일 하나

```
sources/backend/bootstrap/src/main/resources/menu/menu-tree.yaml   ← 사람이 편집
        │  generateMenuSeed
        ▼
db/changelog/data/003-init-menu.csv                        ← 생성물
```

| | |
|---|---|
| **왜 파일 하나인가** | 트리는 **부모와 순서가 전역**이라 쪼갤 수 없다. [52](../../knowledge/sys/menu.md) §4.2 가 이미 한 표다 |
| **왜 문서에서 생성하지 않나** | [52](../../knowledge/sys/menu.md) §4.2 표를 파싱하면 **문서가 코드가 된다** — 표 형식을 다듬다가 빌드가 깨지고, 문서를 고치는 사람이 그것을 모른다 |
| **머지** | YAML 목록이라 **줄 단위로 머지된다.** 부딪혀도 뜻이 분명하다 |

### 2. changeset 은 **표시 → upsert** 이고 삭제가 없다

```yaml
- changeSet:
    id: data-003-menu
    author: generated            # generateMenuSeed
    runOnChange: true
    changes:
      - update:                  # ① 시드 출신을 일단 고아로 표시한다
          tableName: SYS_MENU
          columns: [ { column: { name: SRC_CD, value: ORPHAN } } ]
          where: SRC_CD = 'SEED'
      - loadUpdateData:          # ② 소스에 있는 것만 SEED 로 되돌린다
          tableName: SYS_MENU
          primaryKey: MENU_CD
          file: db/changelog/data/003-init-menu.csv
      # ③ 삭제하지 않는다. 남은 ORPHAN 이 곧 표시다
```

**`SRC_CD` 는 값이 셋이다** — [42](../../knowledge/sys/menu.md) §4 가 컬럼을 갖는다.

| 값 | 뜻 | 누가 쓰나 |
|---|---|---|
| **`SEED`** | 선언 파일에 있다 | 시드 |
| **`USER`** | **운영자가 화면에서 만들었다**([62](../../../documents/screen/menu/requirements.md) §4.6) | 저장 서비스 |
| **`ORPHAN`** | 시드가 만들었는데 **선언에서 사라졌다** | 시드(①이 남긴 것) |

- **①이 `USER` 를 건드리지 않는다** — 운영자가 만든 메뉴는 시드와 무관하게 산다
- **`ORPHAN` 은 [ADR-0023](./0023-message-key-sync-from-source.md) 의 `USE_SCOPE='NONE'` 과 같은 자리다** — 죽었다는 것을
  *표시* 하고 **지우는 것은 사람이 판단한다**

### 3. CSV 에 **담지 않는 컬럼**이 결정의 절반이다

| CSV 에 담는다 | CSV 에 담지 않는다 |
|---|---|
| `MENU_CD` · `UP_MENU_CD` · `MENU_NM` · `MENU_URL` · `EXPORT_YN` · `SRC_CD` | **`SORT_NO` · `ICON_CD` · `USE_YN`** |
| **구조** — 개발이 정한다 | **표시** — 운영이 정한다 |

**`loadUpdateData` 는 CSV 에 담은 컬럼만 갱신한다.** [ADR-0023](./0023-message-key-sync-from-source.md) 이 `MSG_VAL` 을 지키려고
이미 이 성질에 기대고 있으며, 여기서는 **운영자가 드래그한 순서와 켜고 끈 상태**를 지킨다.

- **신규 삽입은 DB 기본값이 채운다** — `SORT_NO DEFAULT 0` · `USE_YN DEFAULT 'Y'` 가
  `NOT NULL` 이므로 CSV 에 없어도 들어간다([42](../../knowledge/sys/menu.md) §4)
- **대가 — 새 시드 메뉴는 `SORT_NO=0` 으로 들어와 `MENU_CD` 순으로 선다.** 받아들인다:
  운영이 한 번 드래그하면 끝이고, **반대(담는 쪽)는 배포마다 그 드래그를 되돌린다**
- `EXPORT_YN` 을 담는 것은 [ADR-0027](./0027-menu-declared-export-action.md) 이 *"시드만 바꾼다. 저장 DTO 에 없다"* 로
  이미 정했기 때문이다 — `0xx-menu-export.yaml` 이 **없어지고** 선언 파일의 한 칸이 된다

### 4. 죽은 메뉴는 **셋째 진단**이 된다

| 대상 | 표시 | 화면 |
|---|---|---|
| API | 매핑 0건 = **미매핑** | `API_CATALOG`([42](../../knowledge/sys/menu.md) §5) |
| 메시지 키 | `USE_SCOPE='NONE'` = **미사용** | `MESSAGE_MGMT`([ADR-0023](./0023-message-key-sync-from-source.md)) |
| **메뉴** | **`SRC_CD='ORPHAN'` = 고아** | **`MENU_TREE`**([62](../../../documents/screen/menu/requirements.md) §4.8) |

`reportSeedImpact`([33](../../standard/_study/seed-generation.md) §4.2)에 항목이 하나 는다 — *"`ORPHAN` 이 되는 메뉴 수와
그로 인해 고아가 되는 부여·즐겨찾기 행 수"*. **막지 않고 센다**는 그 태스크의 원칙 그대로다.

### 5. 협업 규칙 — **생성물의 충돌은 손으로 풀지 않는다**

```bash
git pull --rebase
git checkout --ours -- '**/00*-init-*.csv'   # 어느 쪽이든 상관없다
./gradlew generateSeeds                       # 선언에서 다시 만든다
git add . && git rebase --continue
```

**손으로 푸는 것은 선언 파일뿐이다.** 생성물은 **선언의 함수**이므로 재계산으로 언제나
복구되고, 잘못 풀면 CI 의 `checkSeeds` 가 *재생성 == 커밋본* 에서 막는다. 절차 전체는
[33](../../standard/_study/seed-generation.md) §3 이 갖는다.

**브랜치를 바꾸면 다음 기동이 맞춘다.** 옛 브랜치의 메뉴는 `ORPHAN` 으로 뜨고, 그 브랜치로
돌아가면 `SEED` 로 **돌아온다.** 로컬 DB 를 지울 이유가 없다 — **지워야 하는 것은 스키마
changeset 이 바뀌었을 때뿐**이며 그쪽은 여전히 누적이다.

## 기각한 대안

| 기각 | 이유 |
|---|---|
| **전건 삭제 → 삽입**(`SYS_API` 와 같게) | **FK 가 `RESTRICT` 라 배포가 터진다.** `CASCADE` 로 바꾸면 [ADR-0022](./0022-generated-seed-full-sync.md) §3 이 금지한 *배포가 운영 결정을 지운다* 가 된다. [62](../../../documents/screen/menu/requirements.md) §4.8 의 삭제 게이트도 장식이 된다 |
| **누적을 유지하고 `includeAll` 로 머지만 푼다** | 충돌은 줄지만 **브랜치 전환 오염과 checksum 은 그대로**다. 그리고 *"지금 메뉴가 뭐지"* 에 답하려면 여전히 파일 N개를 순서대로 재생해야 한다 |
| **개발 프로필만 drop-create** | 요구 셋째(*별도 DB 작업 없이*)를 깬다. 그리고 **두 경로가 갈리면 dev 에서 안 나던 문제가 운영에서 난다** |
| **`SORT_NO` 를 CSV 에 담는다** | 배포가 운영 드래그를 **되돌린다.** 순서를 개발이 소유해야 한다면 그것은 *운영이 드래그하지 못하게* 하는 결정이며, [62](../../../documents/screen/menu/requirements.md) §4.5 가 이미 반대로 정했다 |
| **[52](../../knowledge/sys/menu.md) §4.2 표에서 생성** | 문서가 코드가 된다 — §1 |
| **`MENU_TREE` 의 편집을 없애고 코드가 완전히 소유** | 운영이 **폴더를 나누고 순서를 바꾸는** 것은 배포할 일이 아니다([62](../../../documents/screen/menu/requirements.md) §1) |

## 결과

- **[ADR-0022](./0022-generated-seed-full-sync.md) 의 표에서 메뉴가 칸을 옮긴다** — *사람 소유 · 누적* 에서
  **`008-init-message-key` 와 같은 칸**(키는 코드 · 딸린 것은 사람)으로. **공통코드와 메시지
  값은 옮기지 않는다**: 가르는 축은 *개발이 얼마나 자주 바꾸나* 이고, 메뉴는 화면과 1:1 이라
  개발이 바꾸지만 코드 값과 번역은 **운영이 바꾼다**
- **`generateApiSeed` 의 메뉴 시드 입력 문제가 사라진다.** 그 태스크는
  `003-init-menu.yaml` **한 파일**을 읽고 있었고([33](../../standard/_study/seed-generation.md) §2), 메뉴가 파일로 늘어나는 모델에서는
  *어느 파일을 읽을지* 가 미결이었다. **원본이 선언 파일 하나가 되면서 그 질문이 없어진다** —
  두 태스크가 같은 입력을 읽는다
- **`SCREENS` ↔ 메뉴 선언 대조가 CI 에 선다.** `screenRegistry` 에 있는 `MENU_URL` 인데
  선언에 없으면 **실패**다 — 그 화면은 열 수 없다. 반대 방향(선언에 있는데 `SCREENS` 에
  없음)은 *아직 만들지 않은 화면* 이라 정상이다. **지금 17 대 17 로 일치한다**
- **[62](../../../documents/screen/menu/requirements.md) §4.8 의 삭제 게이트에 자식 둘이 는다** — `SYS_USER_SEARCH_COND` ·
  `SYS_USER_GRID_PREF`. 둘 다 `MENU_CD` FK 를 갖는데 표에 없었고, 그대로면 **운영자가 지울
  화면이 없는 채로 삭제가 막힌다** — 그 절이 즐겨찾기에 대해 쓴 *"할 수 있는 일이 없는
  거부는 거부가 아니라 고장"* 이 그대로 걸린다. **즐겨찾기와 같은 칸(함께 지운다)** 으로 넣는다
- **`0xx-menu-export.yaml` 이 없어진다** — `EXPORT_YN` 이 선언 파일의 칸이 되면서
  [33](../../standard/_study/seed-generation.md) §3 절차의 `4-1`(*손으로 쓰는 유일한 인가 시드*)이 사라진다
- **`SYS_MENU.SRC_CD` 컬럼이 는다** — [42](../../knowledge/sys/menu.md) §4. 스키마 changeset 하나이며 기본값은
  `'USER'` 다(기존 행은 시드가 첫 동기화에서 `SEED` 로 덮는다)
- **미결 하나가 남는다** — **기존 배포의 이행**. 이미 `003-init-menu.yaml` 을 적용한 DB 는
  `data-003-menu` changeset 이 `DATABASECHANGELOG` 에 있고, 같은 `id` 를 `runOnChange` 로
  바꾸면 **checksum 이 달라져 한 번 더 돈다** — 그것이 곧 첫 동기화이므로 의도한 동작이지만
  **4벤더에서 확인해야 한다**([33](../../standard/_study/seed-generation.md) §6)
