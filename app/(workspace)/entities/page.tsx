"use client";

import { useRouter } from "next/navigation";
import { ENTITIES } from "@/lib/model";
import { calculateGroup } from "@/lib/engine";
import { useStore } from "@/lib/store";
import { pct } from "@/lib/format";

export default function EntitiesPage() {
  const { groupId } = useStore();
  const calcs = calculateGroup(groupId);
  const router = useRouter();
  return (
    <div className="panel">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th><th>Entity</th><th>Type</th><th>Jur.</th><th>Own %</th><th>GAAP</th><th className="num">ETR</th><th>Harbour</th><th className="num">Complete</th><th>Review</th>
            </tr>
          </thead>
          <tbody>
            {ENTITIES.map((e) => {
              const c = calcs.find((x) => x.iso === e.iso);
              return (
                <tr key={e.id} className="clickable" onClick={() => router.push(`/etr?iso=${e.iso}`)}>
                  <td className="mono">{e.code}</td>
                  <td>{e.name}</td>
                  <td>{e.type}</td>
                  <td>{e.iso}</td>
                  <td>{e.ownership}%</td>
                  <td>{e.gaap}</td>
                  <td className="num">{pct(c?.etr ?? 0, 1)}</td>
                  <td>{c?.sh.outcome}</td>
                  <td className="num">{e.completeness}%</td>
                  <td><span className="status-prep">{e.review}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
