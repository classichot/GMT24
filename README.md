# GMT24

**AI-powered Global Minimum Tax operating system for multinational groups.**

> From financial data to Pillar Two compliance. Automatically.

GMT24 is not a Pillar Two calculator. It converts an MNE’s financial, tax, CbCR, entity, TP and incentive data into a controlled Pillar Two data model, applies versioned OECD and jurisdictional rules, performs deterministic GloBE calculations, tests safe harbours, determines QDMTT / IIR / UTPR outcomes, prepares the GloBE Information Return, and keeps a calculation-to-source audit trail.

```
SOURCE DATA → AI MAPPING → RULES → CALCULATION → EXPLANATION → GIR → AUDIT
```

## Architectural principle

**AI handles messy data, mapping, interpretation, explanation and review. A deterministic tax engine performs the actual Pillar Two calculations.**

An LLM never calculates Pillar Two. Every number is reproducible, rule-versioned and traceable to source data.

## Five layers

1. **Data Engine** — ingest, classify, map
2. **Pillar Two Rules Engine** — effective-dated OECD + local rule packs
3. **Calculation Engine** — deterministic DAG (integer euro arithmetic)
4. **Compliance Engine** — GIR, filings, notifications
5. **AI Intelligence Layer** — mapping, gaps, explanation, review

## Modes

- **In-house** — single MNE tax team workspace (Group Tax Director / Local Tax / Finance)
- **Advisor** — multi-client advisory portfolio with engagement control
- **Host desk** (`/host`) — 7L mints a signed `/review/{token}` demo URL (1–14 days, default 3). Recipients open it on another device until expiry.

## Prototype

This is a full interactive prototype with a seeded Japanese UPE group (Aetherion). Sign in, pick a mode, and click any euro amount for the one-click audit trail.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Demo login: `m.sato@aetherion.com` / `demo1234`
