/** 순서가 필요한 훅들을 자식 프로세스로 직렬 실행하고 결과 하나로 합친다. */

import { join } from 'node:path';
import { REPO, runEmbeddedHook } from './lib.mjs';

export async function runHookChain(input, scripts) {
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
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: `${message}\n보호 훅을 복구한 뒤 다시 시도한다.`,
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
