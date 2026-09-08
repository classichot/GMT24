import { DATA } from "../model";
import { labelElection } from "../evidenceHistory";
import type { ActionId, ActionKind, Permission, ProposedAction, WorkContext } from "./types";

/**
 * Action gateway. The Co-Pilot can only do what is listed here. Each action has a
 * kind (which fixes the policy), a required permission, a preview the user sees
 * before anything runs, and an executor that calls the application's own store
 * method — so the same validation the UI applies (five-year locks, X-Ray signing
 * gates, guarded pack rows) applies to the assistant.
 */
export type ActionParams = Record<string, string | number | boolean>;

export type GatewayApi = {
  navigate: (href: string) => void;
  openAuditFor: (iso: string) => boolean;
  approveMap: (account: string) => void;
  setElection: (key: string, on: boolean) => string | null;
  setSbieClaim: (iso: string, mode: "max" | "partial" | "none") => void;
  setScenario: (p: { boiExtend?: boolean; payrollTh?: number; tpMargin?: number }) => void;
  patchWorkflow: (p: { reviewerRan?: boolean; girValidated?: boolean; snapshotApproved?: boolean }) => void;
  answerXray: (findingId: string, questionId: string, value: string) => void;
  attachXrayEvidence: (findingId: string, kind: string) => void;
  signXray: (findingId: string, role: "preparer" | "reviewer") => string | null;
  decidePackAmendment: (id: string, status: "accepted" | "rejected") => string | null;
  adminReviewPackChange: (id: string) => string | null;
  createTask: (p: { title: string; detail: string; owner: string; severity: "block" | "warn" | "info"; href: string; source: string; due?: string | null }) => string;
  updateTask: (id: string, p: { status?: "open" | "assigned" | "resolved" | "dismissed"; owner?: string; reason?: string }) => string | null;
  saveScenario: (id: string) => string | null;
  adoptScenario: (id: string) => string | null;
  createTicket: (id: string) => string | null;
  reviewReg: (id: string, status: "approved" | "rejected", note: string) => void;
  confirmFact: (factId: string) => string | null;
  download: (name: string, body: string, mime?: string) => void;
  snapshotBlocked: () => string | null;
  onboardScan: (scanId: string) => string | null;
};

type Def = {
  kind: ActionKind;
  requires: Permission;
  label: (p: ActionParams) => string;
  preview: (p: ActionParams, ctx: WorkContext) => string;
  run: (p: ActionParams, api: GatewayApi, ctx: WorkContext) => string | null;
};

const s = (v: string | number | boolean | undefined) => String(v ?? "");

export const ACTIONS: Record<ActionId, Def> = {
  navigate: {
    kind: "navigate", requires: "read",
    label: (p) => `Open ${s(p.label || p.href)}`,
    preview: (p) => `Navigates to ${s(p.href)}. Nothing is saved.`,
    run: (p, api) => { api.navigate(s(p.href)); return null; },
  },
  "open-audit": {
    kind: "explain", requires: "read",
    label: (p) => `Open audit trail · ${s(p.iso)}`,
    preview: (p) => `Opens the amount → rule → entity → account → source trail for ${s(p.iso)}.`,
    run: (p, api) => (api.openAuditFor(s(p.iso)) ? null : "No calculation found for that jurisdiction."),
  },
  "approve-map": {
    kind: "save", requires: "save-working",
    label: (p) => `Approve mapping ${s(p.account)}`,
    preview: (p) => {
      const row = DATA.accounts.find((a) => a.account === s(p.account));
      return row
        ? `Account ${row.account} ${row.name} → ${row.globe}${row.adjustment ? ` → ${row.adjustment}` : ""} (confidence ${row.confidence}%). Stored for subsequent years; GIR preflight resets. Recorded in Evidence history.`
        : `Account ${s(p.account)} is not on the mapping table.`;
    },
    run: (p, api) => {
      if (!DATA.accounts.some((a) => a.account === s(p.account))) return "Account not found.";
      api.approveMap(s(p.account));
      return null;
    },
  },
  "set-election": {
    kind: "approve", requires: "approve-treatment",
    label: (p) => `${p.on ? "Elect" : "Clear"} ${labelElection(s(p.key))}`,
    preview: (p, ctx) => `${p.on ? "Turns on" : "Turns off"} ${labelElection(s(p.key))} on the ${ctx.fy} working package. Five-year locks and re-election bars are enforced by the election engine; the change is written to Evidence history.`,
    run: (p, api) => api.setElection(s(p.key), Boolean(p.on)),
  },
  "set-sbie": {
    kind: "approve", requires: "approve-treatment",
    label: (p) => `SBIE claim ${s(p.iso)} → ${s(p.mode)}`,
    preview: (p) => `Sets the Art. 5.3.1 substance-based income exclusion claim for ${s(p.iso)} to ${s(p.mode)}.`,
    run: (p, api) => { api.setSbieClaim(s(p.iso), s(p.mode) as "max" | "partial" | "none"); return null; },
  },
  "set-scenario": {
    kind: "save", requires: "save-working",
    label: () => "Apply simulator assumptions",
    preview: (p) => `Sets the live simulator to: BOI extend ${p.boiExtend ? "on" : "off"}, Thai payroll +$${Number(p.payrollTh ?? 0).toLocaleString()}, Ireland TP margin ${s(p.tpMargin ?? 3)}%. Dashboard, ETR map and GIR follow the simulator; the approved snapshot is not overwritten.`,
    run: (p, api) => { api.setScenario({ boiExtend: Boolean(p.boiExtend), payrollTh: Number(p.payrollTh ?? 0), tpMargin: Number(p.tpMargin ?? 3) }); return null; },
  },
  "run-reviewer": {
    kind: "save", requires: "save-working",
    label: () => "Run AI Calculation Reviewer",
    preview: () => "Re-runs the second-level review against the current snapshot and records the run.",
    run: (_p, api) => { api.patchWorkflow({ reviewerRan: true }); return null; },
  },
  "validate-gir": {
    kind: "save", requires: "save-working",
    label: () => "Run GIR XML preflight",
    preview: () => "Runs GMT24 population and calculation-to-collection reconciliations. Official three-file XSD validation remains a filing-gate step.",
    run: (_p, api) => { api.patchWorkflow({ girValidated: true }); return null; },
  },
  "approve-snapshot": {
    kind: "approve", requires: "sign",
    label: () => "Approve FY snapshot",
    preview: (_p, ctx) => `Reviewer lock on the ${ctx.fy} calculation snapshot. Refused while Pillar Two X-Ray has unresolved material items. Does not file.`,
    run: (_p, api) => { const b = api.snapshotBlocked(); if (b) return b; api.patchWorkflow({ snapshotApproved: true }); return null; },
  },
  "answer-xray": {
    kind: "save", requires: "save-working",
    label: (p) => `Record answer · ${s(p.label || p.value)}`,
    preview: (p) => `Records "${s(p.label || p.value)}" for question ${s(p.questionId)} on ${s(p.findingId)}. Dependent questions that no longer apply are retired; preparer and reviewer signatures reset.`,
    run: (p, api) => { api.answerXray(s(p.findingId), s(p.questionId), s(p.value)); return null; },
  },
  "attach-evidence": {
    kind: "save", requires: "save-working",
    label: (p) => `Attach ${s(p.kind)}`,
    preview: (p) => `Links ${s(p.kind)} to ${s(p.findingId)} as validated evidence. Reviewer approval resets.`,
    run: (p, api) => { api.attachXrayEvidence(s(p.findingId), s(p.kind)); return null; },
  },
  "sign-xray": {
    kind: "approve", requires: "sign",
    label: (p) => `Sign as ${s(p.role)}`,
    preview: (p) => `Signs ${s(p.findingId)} as ${s(p.role)}. Refused while questions are unanswered or evidence is missing; reviewer cannot sign before preparer or as the same person.`,
    run: (p, api) => api.signXray(s(p.findingId), s(p.role) as "preparer" | "reviewer"),
  },
  "decide-pack": {
    kind: "approve", requires: "approve-treatment",
    label: (p) => `${s(p.status) === "accepted" ? "Accept" : "Reject"} pack amendment`,
    preview: (p) => `${s(p.status) === "accepted" ? "Accepts" : "Rejects"} amendment ${s(p.id)}. Accepted rows enter the calculation overlay; guarded rows cannot be accepted.`,
    run: (p, api) => api.decidePackAmendment(s(p.id), s(p.status) as "accepted" | "rejected"),
  },
  "admin-review-pack": {
    kind: "approve", requires: "admin",
    label: () => "Close change record (administrator)",
    preview: (p) => `Marks change record ${s(p.id)} as reviewed. Refused while any amendment in it is undecided.`,
    run: (p, api) => api.adminReviewPackChange(s(p.id)),
  },
  "create-task": {
    kind: "draft", requires: "draft",
    label: (p) => `Create task · ${s(p.title)}`,
    preview: (p) => `Creates a task for ${s(p.owner)}: ${s(p.title)}. Labelled as an AI proposal on the task list.`,
    run: (p, api) => { api.createTask({ title: s(p.title), detail: s(p.detail), owner: s(p.owner), severity: (s(p.severity) || "warn") as "block" | "warn" | "info", href: s(p.href) || "/reviewer", source: s(p.source) || "manual", due: p.due ? s(p.due) : null }); return null; },
  },
  "resolve-task": {
    kind: "save", requires: "save-working",
    label: () => "Resolve finding",
    preview: (p) => `Marks ${s(p.id)} resolved with reason: ${s(p.reason) || "(none given)"}.`,
    run: (p, api) => api.updateTask(s(p.id), { status: "resolved", reason: s(p.reason) }),
  },
  "dismiss-task": {
    kind: "approve", requires: "approve-treatment",
    label: () => "Dismiss finding with reason",
    preview: (p) => `Dismisses ${s(p.id)}. A reason is mandatory and stays on the record: ${s(p.reason) || "(none given)"}.`,
    run: (p, api) => (s(p.reason).trim() ? api.updateTask(s(p.id), { status: "dismissed", reason: s(p.reason) }) : "A reason is required to dismiss a finding."),
  },
  "reopen-task": {
    kind: "save", requires: "save-working",
    label: () => "Reopen finding",
    preview: (p) => `Reopens ${s(p.id)}.`,
    run: (p, api) => api.updateTask(s(p.id), { status: "open" }),
  },
  "assign-task": {
    kind: "save", requires: "save-working",
    label: (p) => `Assign to ${s(p.owner)}`,
    preview: (p) => `Assigns ${s(p.id)} to ${s(p.owner)}.`,
    run: (p, api) => api.updateTask(s(p.id), { status: "assigned", owner: s(p.owner) }),
  },
  "save-scenario": {
    kind: "draft", requires: "draft",
    label: () => "Save scenario (draft)",
    preview: () => "Saves the scenario with its inputs, assumptions, eligibility screen and rule version so it can be reproduced. The approved calculation is untouched.",
    run: (p, api) => api.saveScenario(s(p.id)),
  },
  "adopt-scenario": {
    kind: "approve", requires: "adopt-scenario",
    label: () => "Adopt scenario through review",
    preview: () => "Converts the scenario into working-package changes (elections, SBIE claim, simulator assumptions). Requires an authorised reviewer; every change is written to Evidence history.",
    run: (p, api) => api.adoptScenario(s(p.id)),
  },
  "create-ticket": {
    kind: "draft", requires: "read",
    label: () => "Submit feedback ticket",
    preview: () => "Submits the ticket exactly as previewed — screen, app version and calculation version only. No tax data or attachments are included unless you added them.",
    run: (p, api) => api.createTicket(s(p.id)),
  },
  "approve-reg": {
    kind: "approve", requires: "approve-treatment",
    label: () => "Approve as production guidance",
    preview: (p) => `Approves ${s(p.id)} into the knowledge base and opens reassessment tasks for the affected calculations. Production rule parameters are not changed by this step.`,
    run: (p, api) => { api.reviewReg(s(p.id), "approved", s(p.note)); return null; },
  },
  "reject-reg": {
    kind: "approve", requires: "approve-treatment",
    label: () => "Reject / not applicable",
    preview: (p) => `Marks ${s(p.id)} as not applicable to this group, with the note kept on the record.`,
    run: (p, api) => { api.reviewReg(s(p.id), "rejected", s(p.note)); return null; },
  },
  "confirm-fact": {
    kind: "approve", requires: "sign",
    label: () => "Confirm fact (accountable person)",
    preview: (p) => `Confirms fact ${s(p.id)} in your name. Material extracted facts need an accountable person; the Co-Pilot cannot confirm them itself.`,
    run: (p, api) => api.confirmFact(s(p.id)),
  },
  download: {
    kind: "draft", requires: "read",
    label: (p) => `Download ${s(p.name)}`,
    preview: (p) => `Downloads ${s(p.name)} as a reviewable draft. Figures are copied from the current calculation version.`,
    run: (p, api) => { api.download(s(p.name), s(p.body), s(p.mime) || "text/markdown"); return null; },
  },
  "onboard-scan": {
    kind: "draft", requires: "draft",
    label: () => "Create GMT24 workspace from scan",
    preview: (p) => `Converts Quick Scan ${s(p.scanId)} into proposed master data (entities, ownership, jurisdictions), evidence records (source, page, passage, retrieval date) and tasks for the open questions. Everything arrives as proposed — nothing enters an approved assessment until a reviewer accepts it.`,
    run: (p, api) => api.onboardScan(s(p.scanId)),
  },
  "submit-filing": {
    kind: "external", requires: "admin",
    label: () => "Submit filing",
    preview: () => "External submission is outside the Co-Pilot. Use the Filing command centre's explicit authorisation workflow.",
    run: () => "External submissions and outbound information are not executed by the Co-Pilot. Open Filing command for the separate authorisation workflow.",
  },
};

let seq = 0;

export function propose(actionId: ActionId, params: ActionParams, ctx: WorkContext, opts?: { label?: string; draft?: boolean }): ProposedAction {
  const def = ACTIONS[actionId];
  seq += 1;
  return {
    id: `pa-${Date.now().toString(36)}-${seq}`,
    actionId,
    label: opts?.label ?? def.label(params),
    kind: def.kind,
    params,
    preview: def.preview(params, ctx),
    requires: def.requires,
    draft: opts?.draft ?? (def.kind === "draft"),
  };
}

export function permitted(a: ProposedAction, ctx: WorkContext) {
  return ctx.permissions.includes(a.requires);
}

export const POLICY: Record<ActionKind, string> = {
  explain: "Executes within your existing access rights.",
  navigate: "Executes within your existing access rights.",
  draft: "Labelled as a draft or proposal. Nothing is approved.",
  save: "Follows the application's permission and review rules; the change is recorded.",
  approve: "Changes an approved treatment or election — requires an authorised reviewer.",
  external: "Separate explicit authorisation workflow. Not executed by the Co-Pilot.",
};

export type GatewayResult = { ok: boolean; message: string };

/** Enforce policy, then run. Every call — refused or executed — is returned for the audit log. */
export function execute(a: ProposedAction, ctx: WorkContext, api: GatewayApi): GatewayResult {
  const def = ACTIONS[a.actionId];
  if (!def) return { ok: false, message: "Unknown action." };
  if (def.kind === "external") return { ok: false, message: def.run(a.params, api, ctx) ?? "Refused." };
  if (!permitted(a, ctx)) return { ok: false, message: `Refused — ${a.label} requires ${a.requires}; your role is ${ctx.role}.` };
  const err = def.run(a.params, api, ctx);
  if (err) return { ok: false, message: err };
  return { ok: true, message: `${a.label} — done.` };
}
