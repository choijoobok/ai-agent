@AGENTS.md

# Claude Code 전용 어댑터

공통 프로젝트 규칙의 정본은 [`AGENTS.md`](AGENTS.md)다. 이 파일에는 Claude Code에서만
달라지는 사용법만 둔다.

- 프로젝트 스킬은 `/스킬명`으로 직접 부른다.
- 훅 배선은 [`.claude/settings.json`](.claude/settings.json), 구현 메모는
  [`aidd-guide/harness/providers/claude-code.md`](aidd-guide/harness/providers/claude-code.md)를 따른다.
- 컨텍스트는 `.claude/hooks/context-gauge.mjs`가 Claude transcript의 실측 usage를 보고
  임계값에서 `/compact`를 권한다. Codex의 압축 정책과 수치를 공유하지 않는다.
- 커밋 메시지 끝은 `Agent: Claude`다(AGENTS.md §9 — 두 AI 가 같은 형식으로 적는다).
  **Claude가 커밋을 만들도록 사용자가 요청한 경우에는** 그 아래에
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`를 함께 붙인다.
