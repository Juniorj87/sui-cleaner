import type { ReactNode } from "react";

/**
 * WALLET EXCAVATION v2 actions.
 * Primary — the bronze expedition button (SCAN / SIGN).
 * Secondary — the quiet outline link (EXPLORE DEMO / BACK).
 * Danger — the destructive action button (CLEAN).
 */
export function BtnPrimary({
  children,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled} className={`btn btn-primary ${className ?? ""}`}>
      {children}
    </button>
  );
}

export function BtnGhost({
  children,
  onClick,
  disabled,
  className,
  light: _light,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  /** ignored — the quiet link looks the same everywhere */
  light?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} className={`btn btn-secondary ${className ?? ""}`}>
      {children}
    </button>
  );
}

export function BtnDanger({
  children,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled} className={`btn btn-danger ${className ?? ""}`}>
      {children}
    </button>
  );
}

export function Eyebrow({ children, light }: { children: ReactNode; light?: boolean }) {
  return (
    <p
      className={`font-mono text-[10px] font-semibold uppercase tracking-[0.4em] ${
        light ? "text-mut/70" : "text-mut"
      }`}
    >
      {children}
    </p>
  );
}

export function shortAddr(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
