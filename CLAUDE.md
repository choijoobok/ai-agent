@AGENTS.md

# Claude Code 전용 어댑터

공통 프로젝트 규칙의 정본은 [`AGENTS.md`](AGENTS.md)다. 이 파일에는 Claude Code에서만
달라지는 사용법만 둔다.

- 프로젝트 스킬은 `/스킬명`으로 직접 부른다.
- 훅 배선은 [`.claude/settings.json`](.claude/settings.json), 구현 메모는
  [`aidd-guide/harness/providers/claude.md`](aidd-guide/harness/providers/claude.md)를 따른다.
- 컨텍스트는 `.claude/hooks/context-gauge.mjs`가 Claude transcript의 실측 usage를 보고
  임계값에서 `/compact`를 권한다. Codex의 압축 정책과 수치를 공유하지 않는다.
- Claude가 커밋을 만들도록 사용자가 요청한 경우에만 메시지 끝에
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`를 붙인다.
