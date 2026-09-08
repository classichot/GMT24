import { DATA } from "../model";
import { findingStatus, type XrayFinding, type XrayState } from "../xray";
import type { ManualTask, Task, TaskOverride, TaskStatus } from "./types";

/**
 * Issue and task service. One list, many sources: data-quality issues, X-Ray
 * confirmations, reviewer findings, regulatory reassessments, rehearsal gaps and
 * manually created tasks. Overrides carry assignment, due date and resolution;
 * the underlying source keeps producing the task until it is genuinely fixed, so
 * a dismissed task shows as dismissed rather than disappearing.
 */
export type TaskInput = {
  findings: XrayFinding[];
  xray: XrayState;
  reviewer: { id: string; title: string; detail: string; owner: string; severity: Task["severity"]; href: string; iso?: string; entityId?: string }[];
  overrides: Record<string, TaskOverride>;
  manual: ManualTask[];
  fy: string;
};

const SEED_AT = "2026-08-13T09:00:00.000Z";

export function deriveTasks(i: TaskInput): Task[] {
  const out: Task[] = [];
  for (const iss of DATA.issues) {
    out.push({
      id: `task:issue:${iss.id}`,
      source: "issue",
      title: `${iss.id} · ${iss.title}`,
      detail: iss.detail,
      owner: iss.owner,
      due: iss.severity === "block" ? "2026-10-15" : null,
      status: "open",
      severity: iss.severity,
      href: "/issues",
      iso: undefined,
      entityId: iss.entity,
      createdAt: SEED_AT,
    });
  }
  for (const f of i.findings) {
    const st = findingStatus(f, i.xray[f.id]);
    if (st === "resolved") continue;
    out.push({
      id: `task:xray:${f.id}`,
      source: "xray",
      title: `${f.title} · ${f.entityCode}`,
      detail: `${f.missing} Route: ${f.dept}. Status: ${st}.`,
      owner: f.owner,
      due: f.severity === "material" ? "2026-10-01" : null,
      status: "open",
      severity: f.severity === "material" ? "block" : f.severity === "significant" ? "warn" : "info",
      href: `/xray/confirm?finding=${f.id}`,
      iso: f.iso,
      entityId: f.entityId,
      createdAt: SEED_AT,
    });
  }
  for (const r of i.reviewer) {
    out.push({
      id: `task:reviewer:${r.id}`,
      source: "reviewer",
      title: r.title,
      detail: r.detail,
      owner: r.owner,
      due: null,
      status: "open",
      severity: r.severity,
      href: r.href,
      iso: r.iso,
      entityId: r.entityId,
      createdAt: SEED_AT,
    });
  }
  for (const m of i.manual) out.push({ ...m });
  return out.map((t) => {
    const o = i.overrides[t.id];
    if (!o) return t;
    return { ...t, ...o, status: o.status ?? t.status, owner: o.owner ?? t.owner, due: o.due === undefined ? t.due : o.due };
  });
}

export function openTasks(tasks: Task[]) {
  return tasks.filter((t) => t.status === "open" || t.status === "assigned");
}

export function tasksFor(tasks: Task[], owner: string) {
  return openTasks(tasks).filter((t) => t.owner === owner);
}

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  open: "Open",
  assigned: "Assigned",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

export function taskTag(s: TaskStatus) {
  if (s === "resolved") return "tag-ok";
  if (s === "dismissed") return "tag-neutral";
  if (s === "assigned") return "tag-outline";
  return "tag-warn";
}

export function newManualTask(p: Omit<ManualTask, "id" | "createdAt" | "status"> & { status?: TaskStatus }): ManualTask {
  return {
    ...p,
    id: `task:${p.source}:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    status: p.status ?? "open",
  };
}
