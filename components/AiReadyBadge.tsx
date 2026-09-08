/** Compact product badge that sits next to the GMT24 wordmark. */
export function AiReadyBadge({ compact }: { compact?: boolean } = {}) {
  return (
    <span className={`ai-ready${compact ? " compact" : ""}`} title="Language model connected for interpretation. Tax numbers still come from GMT24-CALC.">
      AI ready
    </span>
  );
}

/**
 * Trailing mark on a sidebar menu whose journey calls the language model
 * (Quick Scan, Interviewer, Rehearsal, …). Lights up when the model is reachable.
 */
export function AiMenuBadge({ live }: { live: boolean }) {
  return (
    <span
      className={`ai-menu${live ? " live" : ""}`}
      title={live ? "This menu uses the language model. Tax numbers still come from GMT24-CALC." : "This menu uses the language model when one is configured."}
    >
      AI
    </span>
  );
}
