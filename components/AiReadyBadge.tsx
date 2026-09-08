/** Compact product badge that sits next to the GMT24 wordmark. */
export function AiReadyBadge({ compact }: { compact?: boolean } = {}) {
  return (
    <span className={`ai-ready${compact ? " compact" : ""}`} title="Language model connected for interpretation. Tax numbers still come from GMT24-CALC.">
      AI ready
    </span>
  );
}
