/**
 * 되돌릴 수 없는 명령을 막는다 — AGENTS.md §5-2.
 *
 * <p>2026년 보고된 대형 사고는 전부 <b>파일 쓰기가 아니라 명령 실행</b>이었다 —
 * Amazon Sev-1 4건(2025.12~2026.03, 3/2 약 6시간 장애 · 12만 주문 손실),
 * DataTalks.club(2026.03, 낡은 Terraform state 적용으로 프로덕션 인프라 삭제),
 * PocketOS(2026.04, 에이전트가 프로덕션 DB 와 백업까지 삭제).
 *
 * <p>정책은 하나다 — <b>되돌릴 수 없는 명령은 AI 가 실행하지 않는다.</b> 사용자가 직접
 * 하거나 명시 승인한다. 차단 메시지는 <i>왜 막혔는지</i> 와 <i>어떻게 진행하면 되는지</i> 를
 * 항상 함께 준다. 길을 주지 않는 차단은 사람이 훅을 끄게 만든다.
 */

import { readHookInput, readState, deny, pass } from './lib.mjs';
import { maskReadOnlyArguments } from '../../aidd-guide/harness/runtime/shell-parse.mjs';
import {
  codexPretoolCanaryDenial,
  codexPretoolCanaryRevision,
} from '../../aidd-guide/harness/runtime/codex-hook-revision.mjs';

/** [정규식, 분류, 왜 위험한가] */
const BLOCK = [
  // 인프라 파괴
  [/\bterraform\s+(apply|destroy)\b/i, '인프라', 'Terraform 상태를 실제로 바꾼다'],
  [/\bpulumi\s+(up|destroy)\b/i, '인프라', 'Pulumi 스택을 실제로 바꾼다'],
  [/\bkubectl\s+delete\b/i, '인프라', '쿠버네티스 리소스를 삭제한다'],
  [/\bhelm\s+(uninstall|delete|rollback)\b/i, '인프라', 'Helm 릴리스를 제거·되돌린다'],
  [/\baws\s+\S+\s+delete-/i, '인프라', 'AWS 리소스를 삭제한다'],
  [/\baws\s+s3\s+rb\b/i, '인프라', 'S3 버킷을 삭제한다'],
  [/\baws\s+s3\s+rm\b.*--recursive/i, '인프라', 'S3 객체를 재귀 삭제한다'],
  [/\bgcloud\s+\S+\s+delete\b/i, '인프라', 'GCP 리소스를 삭제한다'],
  [/\baz\s+\S+\s+delete\b/i, '인프라', 'Azure 리소스를 삭제한다'],
  // 데이터 파괴
  [/\bDROP\s+(DATABASE|SCHEMA|TABLE|TABLESPACE)\b/i, '데이터', '테이블·DB 를 삭제한다'],
  [/\bTRUNCATE\s+(TABLE\s+)?\w/i, '데이터', '테이블 내용을 전부 비운다'],
  [/\bDELETE\s+FROM\s+\w+\s*(;|"|'|$)/i, '데이터', 'WHERE 절 없는 DELETE 다'],
  [/\bUPDATE\s+\w+\s+SET\b(?!.*\bWHERE\b)/i, '데이터', 'WHERE 절 없는 UPDATE 다'],
  [/\bflushall\b|\bflushdb\b/i, '데이터', 'Redis 데이터를 전부 삭제한다'],
  [/\bdropDatabase\s*\(/i, '데이터', 'MongoDB 데이터베이스를 삭제한다'],
  // 시스템
  [/\bmkfs(\.\w+)?\b/i, '시스템', '파일시스템을 포맷한다'],
  [/\bdd\s+.*\bof=\/dev\//i, '시스템', '블록 디바이스에 직접 쓴다'],
  [/>\s*\/dev\/(sd|nvme|hd)/i, '시스템', '블록 디바이스에 직접 쓴다'],
  [/\bchmod\s+(-R\s+)?777\s+\//i, '시스템', '루트 권한을 광범위하게 바꾼다'],
  [/\b(shutdown|reboot|halt)\b/i, '시스템', '시스템을 중단한다'],
  [/\bdocker\s+system\s+prune\b/i, '시스템', '도커 리소스를 광범위하게 삭제한다'],
  [/\bdocker\s+volume\s+rm\b/i, '시스템', '도커 볼륨(데이터)을 삭제한다'],
  // 형상·배포
  [/\bgit\s+push\b.*(--force\b|-f\b)/i, '형상', '원격 이력을 덮어쓴다'],
  [/\bgit\s+reset\s+--hard\b/i, '형상', '작업 내용을 되돌릴 수 없게 버린다'],
  [/\bgit\s+clean\s+-[a-z]*f/i, '형상', '추적되지 않은 파일을 삭제한다'],
  [/\bgit\s+branch\s+-D\b/i, '형상', '브랜치를 강제 삭제한다'],
  [/\bnpm\s+publish\b/i, '배포', '패키지를 공개 배포한다'],
  [/\bmvn\s+\S*\s*deploy\b/i, '배포', '아티팩트를 배포한다'],
  [/\bgh\s+release\s+(create|delete)\b/i, '배포', '릴리스를 생성·삭제한다'],
  [/\bgh\s+repo\s+delete\b/i, '배포', '저장소를 삭제한다'],
];

/** 프로젝트 범위를 벗어나는 삭제 — 아래 RM_SAFE 에 걸리면 통과한다. */
const RM_DANGEROUS = [
  /\brm\s+(-\S+\s+)*\S*[rf]\S*\s+\/\s*$/i,
  /\brm\s+(-\S+\s+)*\S*[rf]\S*\s+\/[a-zA-Z]/i,
  /\brm\s+(-\S+\s+)*\S*[rf]\S*\s+~/i,
  /\brm\s+(-\S+\s+)*\S*[rf]\S*\s+[A-Za-z]:[/\\]/i,
  /\brm\s+(-\S+\s+)*\S*[rf]\S*\s+\$\w+\s*\/?\s*$/i,
  /\brm\s+(-\S+\s+)*\S*[rf]\S*\s+\*/i,
  /\brm\s+(-\S+\s+)*\S*[rf]\S*\s+\.\s*$/i,
  /\brm\s+(-\S+\s+)*\S*[rf]\S*\s+\.\./i,
];

/** 지워도 되는 것 — 산출물과 의존성. `.gitignore` 가 무시하는 것들이다. */
const RM_SAFE =
  /(node_modules|dist|build|target|\.next|\.venv|__pycache__|coverage|\.pytest_cache|\.gradle|\.mypy_cache|out\/|tmp\/|temp\/)/i;

const PROD_SIGNALS = [/\b(prod|production|prd)\b/i, /--profile[= ]\S*prod/i];

/** 읽기만 하는 명령은 운영 신호가 있어도 막지 않는다. */
const READ_ONLY = /\b(get|list|describe|show|status|logs?|plan|diff|cat|grep|head|tail|find|ls)\b/i;

const input = await readHookInput();
const command = String(input?.tool_input?.command ?? '').trim();
if (!command) pass();

/* 새 Codex 실행이 이 사전 훅을 실제로 싣고 있는지 보는 무해한 카나리다. 스크립트가
   실행되기 전에 여기서 막혀야 하며, 실행됐다면 앱이 현재 훅 배선을 싣지 않은 것이다. */
const canaryRevision = codexPretoolCanaryRevision(command);
if (canaryRevision) deny(codexPretoolCanaryDenial(canaryRevision));

const state = readState();
if (!state?.current) pass();

/**
 * <b>커밋 메시지는 명령이 아니다.</b> {@code git commit -F -} 의 heredoc 본문까지 훑으면
 * <i>production</i> · <i>prod</i> 가 든 <b>정직한 커밋 메시지가 막힌다</b> — 실제로
 * 2026-09-05 에 <i>"백엔드 production 클래스"</i> 라고 적은 메시지가 운영환경 신호로
 * 걸렸다. 그때 사람이 배우는 것은 <b>메시지에서 낱말을 빼는 법</b>이고, 그것은 게이트가
 * 기록을 무르게 만든 것이다.
 *
 * <p><b>{@code git commit} 일 때만</b> 뺀다. {@code sh <<EOF} 의 본문은 진짜 명령이므로
 * 그대로 검사한다 — 여기를 넓히면 heredoc 하나로 전체 가드를 우회하게 된다.
 *
 * <p><b>머리 줄이 같은 heredoc 만 뺀다.</b> 처음에는 명령 <i>전체</i>가
 * {@code git commit} 으로 시작할 때만 뺐는데, {@code git add … && git commit -F - …} 는
 * 그 조건에 걸리지 않아 <b>메시지 본문이 명령으로 훑였다</b> — 2026-09-14 에 훅 변경을
 * 설명하려고 {@code DROP TABLE} 을 인용한 커밋이 그렇게 막혔다. 그렇다고 명령 아무 데나
 * {@code git commit} 이 있으면 전부 빼면 {@code git commit -m x && sh <<EOF} 로 가드를
 * 우회할 수 있다. 그래서 <b>{@code <<TAG} 가 {@code git commit} 과 같은 줄에 있을 때</b>
 * 그 본문만 뺀다. 그 자리에 있는 heredoc 은 커밋 메시지 말고는 될 것이 없다.
 */
function withoutCommitMessage(cmd) {
  return cmd.replace(
    /* `[^\n&|;]` — 머리 줄이 <b>구분자를 넘지 못한다.</b> 넘게 두면
       `git commit -m x && sh <<EOF` 의 `sh` 본문까지 커밋 메시지로 읽혀 가드가 열린다. */
    /(\bgit\s+commit\b[^\n&|;]*?)<<-?\s*'?"?([A-Za-z_][A-Za-z0-9_]*)'?"?([^\n&|;]*)\n[\s\S]*?^\s*\2\s*$/gm,
    '$1<<HEREDOC$3',
  );
}

/* **검색어는 명령이 아니다.** `rg -n "DROP DATABASE" …` 가 파괴적 SQL 로 읽혀 순수 검색이
   막혔다(2026-09-14). 가르는 것은 따옴표가 아니라 그 앞에 선 명령의 이름이다 —
   `psql -c "DROP …"` 은 그대로 걸린다. 근거는 runtime/shell-parse.mjs. */
const flat = maskReadOnlyArguments(withoutCommitMessage(command)).split(/\s+/).join(' ');
const hit = check(flat);
if (!hit) pass();

const [kind, why] = hit;
deny(
  [
    `[${kind}] 되돌릴 수 없는 명령이라 실행하지 않는다.`,
    '',
    `명령: ${command.slice(0, 300)}`,
    `사유: ${why}`,
    '',
    '**파괴적 명령은 AI 가 실행하지 않는다**(AGENTS.md §5-2). 2026년의 대형 사고',
    '(Amazon Sev-1 · DataTalks.club 인프라 삭제 · PocketOS DB·백업 삭제)가 모두',
    '에이전트의 자율 명령 실행이었다.',
    '',
    '다음 중 하나로 진행한다:',
    '1. 이 명령을 사용자에게 그대로 제시하고 직접 실행하도록 요청한다',
    '2. 되돌릴 수 있는 대체 방법을 찾는다 — DROP 대신 changeset, `--force` 대신 새 브랜치,',
    '   `apply` 대신 `plan` 결과 제시',
    '3. 꼭 필요하면 **무엇을 · 왜 · 되돌리는 방법**과 함께 사용자 승인을 명시적으로 받는다',
    '',
    '실행 결과가 필요하면 사용자에게 실행 후 출력을 붙여 달라고 요청한다.',
  ].join('\n'),
);

function check(cmd) {
  for (const [pattern, kind, why] of BLOCK) if (pattern.test(cmd)) return [kind, why];
  for (const pattern of RM_DANGEROUS) {
    if (pattern.test(cmd) && !RM_SAFE.test(cmd)) {
      return ['삭제', '프로젝트 범위를 벗어나거나 광범위한 삭제다'];
    }
  }
  for (const pattern of PROD_SIGNALS) {
    if (pattern.test(cmd) && !READ_ONLY.test(cmd)) {
      return ['운영환경', '프로덕션 환경을 바꾸는 것으로 보인다'];
    }
  }
  return null;
}
