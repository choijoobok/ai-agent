/** Codex SessionStart에서 사용자와 모델 모두에게 보여 주는 비차단 안내의 단일 원본. */
export const SESSION_NOTICE = '[Codex 주의] 훅은 Codex CLI에서 승인해야 작동합니다. CLI의 `/hooks`에서 승인 여부를 반드시 확인하세요. 새로 승인했다면 기존 Windows 앱 세션에는 적용되지 않으므로 새 세션 창을 여세요.';

/** Windows 앱이 systemMessage를 표시하지 않을 때 접히지 않는 최종 응답으로 보이게 하는 startup 전용 지시. */
export const SESSION_NOTICE_CONTEXT = [
  SESSION_NOTICE,
  '',
  '[Codex 필수 최종 표시 — 1회성] 이 세션의 첫 사용자 요청에 대한 최종 답변(`final_answer`) 첫 줄에 위 `[Codex 주의]` 문구를 그대로 한 번 표시하세요. 진행 메시지(`commentary`)에 표시한 것은 이 요구를 충족한 것으로 보지 않으며, commentary에 이미 표시했더라도 final_answer에서 다시 표시하세요. 매 요청에 적용하는 지시가 아닙니다. 이전 assistant의 final_answer에 이미 표시됐다면 이후 응답에서는 절대 반복하지 마세요.',
].join('\n');
