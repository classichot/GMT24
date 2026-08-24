"use client";

import Link from "next/link";

export function StartEngage({
  kind = "new",
  block = false,
  onClick,
}: {
  kind?: "new" | "create";
  block?: boolean;
  onClick?: () => void;
}) {
  const className = `btn btn-start${block ? " btn-block" : ""}`;
  const label = kind === "create" ? "Create engagement" : "New engagement";
  const inner = (
    <>
      <span className="btn-start-mark" aria-hidden>+</span>
      {label}
    </>
  );
  if (kind === "create") {
    return (
      <button type="button" className={className} onClick={onClick}>
        {inner}
      </button>
    );
  }
  return (
    <Link href="/onboard" className={className}>
      {inner}
    </Link>
  );
}
