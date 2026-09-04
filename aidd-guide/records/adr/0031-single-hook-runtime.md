# ADR-0031. 훅과 도구는 **Node 하나로** 돈다 — 의존성 0 을 지킨다

- 상태: 채택
- 일자: 2026-09-04
- 관련: [CLAUDE.md](../../../CLAUDE.md) §8 · [harness/hooks.md](../../harness/hooks.md) · [ADR-0030](0030-merge-three-repositories.md)

## 맥락

합친 두 저장소가 훅을 각자 가졌고 **런타임이 달랐다.**

| 출처 | 런타임 | 훅 | 도구 |
|---|---|---|---|
| ordinary-backoffice | **Node** (`.mjs`, 의존성 0) | 6 — `guard-generated` · `guard-commit` · `normalize-encoding` · `doc-drift` · `log-raw` (+`lib`) | — |
| ai-driven-development | **Python 3** (`PyYAML` 권장) | 5 — `session_brief` · `guard_write` · `guard_bash` · `trace_check` · `quality_check` | `_lint.py` (llm-guide 의 문서 게이트) |

**둘 다 유지하는 것이 가장 싸 보였다.** `settings.json` 에 나란히 걸면 이식 비용이 0 이다.
그러나 그러면 다음이 따라온다.

- **런타임 둘을 요구한다.** 폐쇄망 고객사 환경에서 Python 이 없거나 버전이 다를 수 있고,
  `PyYAML` 은 `pip install` 을 요구한다 — **그 설치가 새 참여자의 첫 관문이 된다.**
- **공통 로직이 두 언어에 중복된다.** 저장소 뿌리 찾기, 경로 정규화, 훅 입력 파싱, 차단·경고
  출력 형식이 `_common.py` 와 `lib.mjs` 에 각각 있었다. 한쪽만 고치면 두 훅 집합의 동작이 갈린다.
- **가장 나쁜 실패가 조용하다.** aidd 의 `_common.py` 는 Windows 에서 stdin 을 cp949 로 읽으면
  한글이 든 경로가 깨져 **모든 가드가 조용히 무력화되는** 문제를 상단 4줄로 막고 있었다.
  런타임마다 이런 함정이 따로 있고, **둘을 다 기억해야 하는 상태**가 유지 비용이다.

## 결정

**Node 로 통일한다.** Python 훅 다섯과 `_lint.py` 를 `.mjs` 로 이식하고, 공통 로직을
`lib.mjs` 하나에 모은다.

| 새 이름 | 출처 | 비고 |
|---|---|---|
| `session-brief.mjs` | `session_brief.py` | |
| `guard-write.mjs` | `guard_write.py` | **규칙 하나를 더했다** — 산출물 지도 밖 문서 차단(ADR-0030) |
| `guard-bash.mjs` | `guard_bash.py` | 차단 패턴 그대로 |
| `trace-check.mjs` | `trace_check.py` | `--all` · `--report` 유지. `/trace` 스킬의 실행기 |
| `quality-check.mjs` | `quality_check.py` | 임계값·측정 근거 그대로 |
| `meta/_meta/lint.mjs` | `_meta/_lint.py` | 폴더 이름이 바뀌어 내부 상수도 함께 고쳤다 |

### 의존성 0 을 지키기 위해 최소 YAML 파서를 직접 쓴다

`trace_check.py` 는 `PyYAML` 로 spec 을 읽었다. Node 에는 표준 YAML 파서가 없으므로
`lib.mjs` 에 **우리 spec 형식만 읽는 파서**를 두었다 — 들여쓰기 맵 · 대시 리스트 · 스칼라 ·
인라인 `{}`·`[]` · `|`/`>` 블록 · 주석. 앵커·태그·복합 키·다중 문서는 **지원하지 않는다.**

**일부러 좁게 만들었다.** 형식을 넓히면 *틀리게 파싱한 훅* 이 되고, 틀리게 파싱한 검사기는
아무것도 안 막으면서 초록불을 준다 — 없는 것보다 나쁘다. 지원 범위를 벗어난 문법이 spec 에
들어오면 **파서를 넓히지 말고 spec 을 좁힌다.** SSOT 의 문법이 단순한 것은 비용이 아니라 값이다.

### fail-open 을 유지한다

이식 뒤에도 훅은 전부 fail-open 이다 — 오류가 나도 세션을 막지 않는다. 막는 훅이 죽으면
규율이 사라지지만, **죽은 훅이 세션을 막으면 사람이 훅을 끄고, 꺼진 훅은 없는 훅이다.**

## 버린 안

| 안 | 왜 버렸나 |
|---|---|
| **둘 다 유지 (혼용)** | 위 맥락의 셋. 특히 공통 로직 중복이 시간이 지나며 두 훅 집합의 동작을 갈라놓는다 |
| **Python 으로 통일** | 이식할 코드는 이쪽이 적었다(Node 6 → Python 6 대 Python 6 → Node 6, 비슷하다). 결정한 이유는 코드량이 아니라 **설치 부담**이다 — `node` 는 프론트 빌드에 이미 필요하고(`.nvmrc` 가 22 를 고정한다) Python 은 이 프로젝트의 어떤 빌드도 요구하지 않는다. **없어도 되는 런타임을 규율의 전제로 삼지 않는다** |
| **Node 로 통일하되 `js-yaml` 을 쓴다** | 훅이 자기 의존성을 갖는 순간 `npm i` 가 규율의 전제가 된다. 훅은 `.claude/hooks/` 에 있고 `package.json` 밖이라 설치 자리도 애매하다 — 그 애매함이 폐쇄망에서 비용이 된다 |
| **`trace-check` 만 Python 으로 남긴다** (YAML 때문) | 가장 자주 도는 훅이 가장 무거운 전제를 갖게 된다. spec 을 고칠 때마다 도는 훅이므로, 이것이 안 돌면 추적성 검사가 통째로 사라진다 |

## 결과

- **얻은 것**: 런타임 하나 · 의존성 0 · 공통 로직 한 곳(`lib.mjs`). 새 참여자는 `node` 만 있으면
  훅 열하나가 전부 돈다.
- **잃은 것**: spec YAML 의 문법이 최소 파서의 범위로 제한된다. 이것은 **제약이 아니라 규칙**으로
  다룬다 — [artifact/spec-schema.md](../../artifact/spec-schema.md) 가 쓸 수 있는 문법을 갖는다.
- **감시**: `node .claude/hooks/trace-check.mjs --all` 이 spec 을 못 읽으면 조용히 통과하는 대신
  **오류 0 으로 보고한다.** 파서가 못 읽은 것과 문제가 없는 것이 같아 보이므로, spec 파일을
  더할 때 `--all` 을 돌려 **항목 수가 세어지는지** 확인한다.
