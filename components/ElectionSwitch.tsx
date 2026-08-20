"use client";

export function ElectionSwitch({
  on,
  disabled,
  label,
  onToggle,
}: {
  on: boolean;
  disabled?: boolean;
  label: string;
  onToggle: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      className="elec-switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      title={disabled ? `${label} — not available at this scope` : label}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onToggle(!on);
      }}
    />
  );
}
