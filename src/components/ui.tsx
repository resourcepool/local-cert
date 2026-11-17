'use client';

import { useEffect, useState, type ReactNode } from 'react';

export function Panel({
  title,
  action,
  children,
  className = '',
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    // min-w-0: as a grid/flex child, the default min-width:auto lets the inner
    // table push the column wider than the viewport, defeating overflow-x-auto.
    <section
      className={`min-w-0 rounded border border-ink-700 bg-ink-900/70 backdrop-blur-sm ${className}`}
    >
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-ink-700 px-4 py-2.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">
            {title}
          </h2>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Centered dialog. Closes on Escape and on a click outside the panel. */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/80 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg rounded border border-ink-700 bg-ink-900 shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-ink-700 px-4 py-2.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-xs text-ink-400 hover:text-ink-100"
          >
            fermer
          </button>
        </header>
        <div className="max-h-[75vh] overflow-y-auto p-4">{children}</div>
      </section>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  issued: 'border-accent/40 bg-accent/10 text-accent',
  pending: 'border-info/40 bg-info/10 text-info',
  dns_propagating: 'border-info/40 bg-info/10 text-info',
  validating: 'border-info/40 bg-info/10 text-info',
  failed: 'border-danger/40 bg-danger/10 text-danger',
  revoked: 'border-ink-600 bg-ink-800 text-ink-400',
  expired: 'border-warn/40 bg-warn/10 text-warn',
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLE[status] ?? 'border-ink-600 bg-ink-800 text-ink-300';
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function Button({
  children,
  variant = 'default',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
}) {
  const styles = {
    default: 'border-ink-600 bg-ink-800 text-ink-100 hover:border-ink-400',
    primary: 'border-accent/50 bg-accent/15 text-accent hover:bg-accent/25',
    danger: 'border-danger/40 bg-danger/10 text-danger hover:bg-danger/20',
    ghost: 'border-transparent text-ink-400 hover:text-ink-100',
  }[variant];
  return (
    <button
      {...props}
      className={`rounded border px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${props.className ?? ''}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wider text-ink-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-400">{hint}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded border border-ink-700 bg-ink-950 px-2.5 py-1.5 text-ink-100 outline-none placeholder:text-ink-600 focus:border-accent/60 ${props.className ?? ''}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded border border-ink-700 bg-ink-950 px-2.5 py-1.5 text-ink-100 outline-none focus:border-accent/60 ${props.className ?? ''}`}
    />
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="border-b border-ink-700">
            {head.map((h) => (
              <th
                key={h}
                className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Copyable({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="group inline-flex max-w-full items-center gap-2 text-left"
      title="Copier"
    >
      <code className="truncate text-ink-300 group-hover:text-ink-100">{label ?? value}</code>
      <span className={`shrink-0 text-[10px] ${copied ? 'text-accent' : 'text-ink-600'}`}>
        {copied ? 'copié' : 'copier'}
      </span>
    </button>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs text-danger">
      {children}
    </p>
  );
}

/** Carries the parsed problem body so callers can react to `detail` structurally. */
export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: { type?: string; title?: string; detail?: unknown } | null,
  ) {
    super(message);
  }
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiClientError(body?.title ?? res.statusText, res.status, body);
  }
  return body as T;
}

export interface PreflightCheckView {
  id: string;
  label: string;
  required: boolean;
  ok: boolean;
  note: string;
  why?: string;
}

export function PreflightTable({ checks }: { checks: PreflightCheckView[] }) {
  return (
    <ul className="space-y-1">
      {checks.map((c) => (
        <li key={c.id} className="flex flex-wrap items-baseline gap-x-2 text-[11px]">
          <span
            className={
              c.ok ? 'text-accent' : c.required ? 'text-danger' : 'text-warn'
            }
          >
            {c.ok ? 'OK' : c.required ? 'REFUSÉ' : 'refusé'}
          </span>
          <code className="text-ink-300">{c.label}</code>
          {!c.ok && (
            <span className="text-ink-400">
              {c.required ? '' : '(optionnel) '}
              {c.why ?? c.note}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
