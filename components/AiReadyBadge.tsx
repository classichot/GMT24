/** "AI ready" mark shown beside the GMT24 logo. Same badge on the sidebar and the public pages. */
export default function AiReadyBadge({ style }: { style?: React.CSSProperties }) {
  return (
    <span className="ai-ready" title="GMT24 AI Co-Pilot: grounded in the calculation engine and the approved rulebook" style={style}>
      AI ready
    </span>
  );
}
