/** 순서가 의미인 공통 hook chain의 유일한 실행 원본. */

export const PRE_FILE = Object.freeze(['guard-write.mjs', 'guard-generated.mjs']);
export const PRE_SHELL = Object.freeze(['guard-bash.mjs', 'guard-commit.mjs']);
export const POST_FILE = Object.freeze([
  'normalize-encoding.mjs',
  'hook-syntax.mjs',
  'trace-check.mjs',
  'doc-drift.mjs',
  'guide-drift.mjs',
  'skill-sync.mjs',
  'harness-doc.mjs',
  'commons-doc.mjs',
]);
export const SESSION_START = Object.freeze(['git-sync.mjs', 'session-brief.mjs']);

/* 작업 중간의 재주입(`resume`·`clear`·`compact`)은 <b>당기지 않는다</b> — 그때 파일이
   바뀌면 AI 가 방금 읽은 것과 디스크가 어긋난다. 그래서 `git-sync` 가 빠진 별도 chain 이다. */
export const SESSION_RESUME = Object.freeze(['session-brief.mjs']);

export const CHAINS = Object.freeze({
  pre_file: PRE_FILE,
  pre_shell: PRE_SHELL,
  post_file: POST_FILE,
  session_start: SESSION_START,
  session_resume: SESSION_RESUME,
});
