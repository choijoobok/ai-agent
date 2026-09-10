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

export const CHAINS = Object.freeze({
  pre_file: PRE_FILE,
  pre_shell: PRE_SHELL,
  post_file: POST_FILE,
  session_start: SESSION_START,
});
