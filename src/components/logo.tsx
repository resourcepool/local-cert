/**
 * The local-cert mark: a wax seal with its ribbon, stamped with a check — a
 * certificate that has been validated. Same drawing as src/app/icon.svg; the
 * colours are fixed (not theme tokens) so the mark reads the same on a dark
 * header, a light header and a browser tab.
 */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M10.5 19 8 30l5-2.6L16 30V20z" fill="var(--seal-deep)" />
      <path d="M21.5 19 24 30l-5-2.6L16 30V20z" fill="var(--seal-deep)" />
      <circle cx="16" cy="13" r="11" fill="var(--seal)" />
      <circle cx="16" cy="13" r="7.6" fill="none" stroke="#fff" strokeOpacity=".38" />
      <path
        d="m11.4 13.3 3.1 3.1 6.1-6.4"
        fill="none"
        stroke="#fff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} />
      <span className="font-semibold tracking-tight text-ink-100">
        local<span className="text-accent">-</span>cert
      </span>
    </span>
  );
}
