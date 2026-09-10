/** 순서가 필요한 훅들을 자식 프로세스로 직렬 실행하고 결과 하나로 합친다. */

import { join } from 'node:path';
import { REPO, runEmbeddedHook, repoRelative, targetPath } from './lib.mjs';

/**
 * 훅이 깨졌을 때 <b>무엇으로 고치나</b> — chain 마다 다르다.
 *
 * <p>사전 chain 이 죽으면 그 chain 이 지키던 도구가 통째로 막힌다. 그런데 <b>고칠 때
 * 쓰는 도구가 바로 그것</b>인 경우가 있다(쓰기 chain 이 죽으면 훅 파일을 `Edit` 로 열 수
 * 없다). 막는 것까지는 옳지만 <b>어디로 나가는지 말해 주지 않으면</b> 같은 차단을
 * 반복해서 받는다.
 */
export const RECOVERY = {
  write: '**쓰기 도구가 막혔다** — 훅은 Bash 로 고친다. 원인은 최상위 shell의 `node --check <훅 경로>`가 말해 준다.\n`.claude/hooks/*.mjs`·`.codex/hooks/*.mjs`를 고치는 쓰기만 열려 있다.',
  shell: '**셸이 막혔다** — 훅은 편집 도구(`Edit`)로 고친다. 원인은 `node --check` 가 말해 준다.',
};

export async function runHookChain(input, scripts, recovery = '보호 훅을 복구한 뒤 다시 시도한다.') {
  const outputs = [];
  for (const script of scripts) {
    try {
      const output = await runEmbeddedHook(join(REPO, '.claude/hooks', script), input);
      if (output) outputs.push(output);
      if (isDenied(output)) break;
    } catch (error) {
      const message = `${script} 실행 실패: ${error instanceof Error ? error.message : String(error)}`;
      if (input?.hook_event_name === 'PreToolUse') {
        outputs.push({
          /* 정책이 막은 것과 <b>훅이 죽어서 막힌 것</b>은 다르다 — 표식을 남겨야
             수리 경로를 열지 말지 아래에서 가릴 수 있다. */
          crashed: script,
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: `${message}\n${recovery}`,
          },
        });
        break;
      }
      outputs.push({
        systemMessage: message,
        hookSpecificOutput: {
          hookEventName: input?.hook_event_name ?? 'PostToolUse',
          additionalContext: message,
        },
      });
    }
  }
  return outputs;
}

/** 훅 파일 자신 — 여기만 수리 경로로 연다. 깊이 하나, `.mjs` 하나. */
const REPAIR_PATH = /^(?:\.claude|\.codex)\/hooks\/[^/]+\.mjs$/;

/**
 * <b>깨진 보호가 자기 수리까지 막지 않게 한다.</b>
 *
 * <p>사전 chain 이 <i>죽어서</i> 막았고(정책이 막은 것이 아니고) 쓰려는 것이
 * <b>provider 훅 파일 자신</b>이면 통과시킨다 — 그 경로에는 지키는 생성물이 없다
 * (`SKILL.md` 는 `.claude/skills/` 에 있고 그쪽은 계속 닫혀 있다).
 * 여는 범위가 <b>수리하는 자리 하나</b>인 것이 이 예외의 전부다.
 *
 * <p><b>정책 차단은 절대 열지 않는다.</b> `crashed` 표식이 없으면 그대로 돌려준다 —
 * 게이트를 우회하는 문이 되면 그 순간 게이트가 없는 것과 같다.
 */
export function allowHookRepair(input, outputs) {
  if (!outputs.some((output) => output?.crashed)) return outputs;
  if (!REPAIR_PATH.test(repoRelative(targetPath(input)))) return outputs;

  const broken = outputs.map((output) => output?.crashed).filter(Boolean).join(' · ');
  const message = [
    `**보호 훅이 깨져 있다**(${broken}). 지금은 훅을 고치는 쓰기 하나만 열려 있다.`,
    '**다른 파일의 쓰기는 전부 막혀 있다** — 게이트가 서 있지 않은 상태에서 작업하지 않는다.',
    '고친 뒤 `node --check` 로 확인하고, 그다음에 하던 일로 돌아간다.',
  ].join('\n');
  return [{
    systemMessage: message,
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: message },
  }];
}

export function emitHookResults(outputs, eventName) {
  const denied = outputs.filter(isDenied);
  if (denied.length) {
    const reason = denied.map(reasonOf).filter(Boolean).join('\n\n');
    /* 이벤트마다 <b>차단의 문법이 다르다.</b> `PreToolUse` 만 `permissionDecision` 을 읽고,
       나머지는 `decision: block` 을 읽는다 — 이벤트 이름을 박아 두면 chain 을 다른
       이벤트에 걸었을 때 <i>막았다고 믿는데 안 막히는</i> 상태가 된다. */
    process.stdout.write(JSON.stringify(
      eventName === 'PreToolUse'
        ? {
            hookSpecificOutput: {
              hookEventName: 'PreToolUse',
              permissionDecision: 'deny',
              permissionDecisionReason: reason,
            },
          }
        : { decision: 'block', reason, systemMessage: reason },
    ));
    return;
  }

  const messages = outputs.flatMap(messagesOf).filter(Boolean);
  if (!messages.length) return;
  const message = [...new Set(messages)].join('\n\n');

  /* `SessionStart` 의 표준 출력은 <b>그대로 모델의 문맥</b>이다(`inject()`). JSON 으로
     감싸면 문맥에 JSON 이 들어가므로, 이 이벤트만 날 것으로 낸다. */
  if (eventName === 'SessionStart') {
    process.stdout.write(message.endsWith('\n') ? message : `${message}\n`);
    return;
  }

  process.stdout.write(JSON.stringify({
    systemMessage: message,
    hookSpecificOutput: { hookEventName: eventName, additionalContext: message },
  }));
}

function isDenied(output) {
  return output?.hookSpecificOutput?.permissionDecision === 'deny' || output?.decision === 'block';
}

function reasonOf(output) {
  return output?.hookSpecificOutput?.permissionDecisionReason ?? output?.reason ?? '';
}

/** `inject()` 는 문자열을, `warn()` 은 객체를 낸다 — chain 은 둘 다 받는다. */
function messagesOf(output) {
  if (typeof output === 'string') return [output.trim()];
  return [
    output?.systemMessage,
    output?.hookSpecificOutput?.additionalContext,
  ];
}
