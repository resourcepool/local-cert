'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useT } from '@/lib/i18n/client';
import { fmt } from '@/lib/i18n/format';

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
      className={`min-w-0 rounded-lg border border-ink-700 bg-ink-900 shadow-[0_1px_2px_rgb(0_0_0/0.05)] ${className}`}
    >
      {title && (
        <header className="flex min-h-12 items-center justify-between gap-3 border-b border-ink-700 px-4 py-2">
          <h2 className="text-sm font-semibold text-ink-100">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

/**
 * Centered dialog. Closes on Escape and on a click outside the panel.
 *
 * `guard` is the question asked before a close goes through — set it while the
 * dialog holds work that a stray click would throw away. It is asked inside the
 * dialog, not with window.confirm, so it keeps the console's look and wording.
 */
export function Modal({
  title,
  onClose,
  wide = false,
  guard = null,
  children,
}: {
  title: string;
  onClose: () => void;
  /** room for policy documents and multi-step forms */
  wide?: boolean;
  guard?: string | null;
  children: ReactNode;
}) {
  const t = useT();
  const [asking, setAsking] = useState(false);
  const requestClose = useCallback(() => {
    if (guard) setAsking(true);
    else onClose();
  }, [guard, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // A second Escape dismisses the question, it never confirms the close.
      if (asking) setAsking(false);
      else requestClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [asking, requestClose]);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/80 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-lg border border-ink-700 bg-ink-900 shadow-2xl`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-ink-700 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-ink-100">{title}</h2>
          <button
            type="button"
            onClick={requestClose}
            aria-label={t.ui.modal.close}
            className="rounded-md px-1.5 py-0.5 text-xs text-ink-400 hover:text-ink-100"
          >
            {t.ui.modal.close}
          </button>
        </header>
        {asking && (
          <div
            role="alertdialog"
            aria-label={t.ui.modal.confirmClose}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-warn/40 bg-warn/10 px-4 py-2.5"
          >
            <p className="text-xs leading-relaxed text-warn">{guard}</p>
            <div className="flex gap-2">
              <Button type="button" variant="primary" autoFocus onClick={() => setAsking(false)}>
                {t.ui.modal.keepEditing}
              </Button>
              <Button type="button" variant="danger" onClick={onClose}>
                {t.ui.modal.closeAnyway}
              </Button>
            </div>
          </div>
        )}
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
  const t = useT();
  const labels = t.ui.status as Record<string, string>;
  const cls = STATUS_STYLE[status] ?? 'border-ink-600 bg-ink-800 text-ink-300';
  return (
    <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>
      {labels[status] ?? status.replace(/_/g, ' ')}
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
    default: 'border-ink-700 bg-ink-800 text-ink-100 hover:border-ink-600',
    // Filled: ink-950 is the page colour, so the label contrasts in both themes.
    primary: 'border-accent bg-accent font-semibold text-ink-950 hover:brightness-110',
    danger: 'border-danger/40 bg-danger/10 text-danger hover:bg-danger/20',
    ghost: 'border-transparent text-ink-400 hover:bg-ink-800 hover:text-ink-100',
  }[variant];
  return (
    <button
      {...props}
      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-[background-color,border-color,color,filter] disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${props.className ?? ''}`}
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
      <span className="mb-1 block text-xs font-medium text-ink-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-400">{hint}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-ink-700 bg-ink-950 px-2.5 py-1.5 text-[13px] text-ink-100 outline-none placeholder:text-ink-600 focus:border-accent ${props.className ?? ''}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-md border border-ink-700 bg-ink-950 px-2.5 py-1.5 text-[13px] text-ink-100 outline-none focus:border-accent ${props.className ?? ''}`}
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
                className="px-2 py-2 text-xs font-medium text-ink-400"
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
  const t = useT();
  const { state, copy } = useCopy(value);
  return (
    <button
      type="button"
      onClick={copy}
      className="group inline-flex max-w-full items-center gap-2 text-left"
      title={t.ui.copy.title}
    >
      <code className="truncate text-ink-300 group-hover:text-ink-100">{label ?? value}</code>
      <span
        className={`shrink-0 text-[11px] ${
          state === 'ok' ? 'text-accent' : state === 'failed' ? 'text-danger' : 'text-ink-600'
        }`}
      >
        {state === 'ok'
          ? t.ui.copy.done
          : state === 'failed'
            ? t.ui.copy.failed
            : t.ui.copy.action}
      </span>
    </button>
  );
}

/**
 * Clipboard write that reports whether it worked. navigator.clipboard only
 * exists on https and localhost; a console reached over plain http on a LAN
 * address needs the legacy path, or "copied" would be shown over a clipboard
 * that still holds something else.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** 'idle' -> 'ok' | 'failed' for 1.5 s after a click. */
function useCopy(text: string) {
  const [state, setState] = useState<'idle' | 'ok' | 'failed'>('idle');
  const copy = useCallback(() => {
    void copyText(text).then((ok) => {
      setState(ok ? 'ok' : 'failed');
      setTimeout(() => setState('idle'), ok ? 1500 : 4000);
    });
  }, [text]);
  return { state, copy };
}

/** Copyable block for commands, config files and policy documents. */
export function CodeBlock({ code, title }: { code: string; title?: string }) {
  const t = useT();
  const { state, copy } = useCopy(code);
  return (
    <div className="min-w-0 overflow-hidden rounded-md border border-ink-700 bg-ink-950">
      <div className="flex items-center justify-between gap-3 border-b border-ink-800 px-2.5 py-1">
        <span className="truncate text-[11px] font-medium text-ink-400">{title ?? ''}</span>
        <button
          type="button"
          onClick={copy}
          className={`shrink-0 text-[11px] ${
            state === 'ok'
              ? 'text-accent'
              : state === 'failed'
                ? 'text-danger'
                : 'text-ink-400 hover:text-ink-100'
          }`}
        >
          {state === 'ok'
            ? t.ui.copy.done
            : state === 'failed'
              ? t.ui.copy.blockFailed
              : t.ui.copy.action}
        </button>
      </div>
      <pre className="max-h-96 overflow-auto p-2.5 text-[11.5px] leading-relaxed text-ink-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Numbered progress header for the multi-step dialogs. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mb-5 flex items-center gap-2 border-b border-ink-800 pb-4 text-xs">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li
            key={label}
            aria-current={active ? 'step' : undefined}
            className={`flex min-w-0 items-center gap-2 ${i < steps.length - 1 ? 'flex-1' : ''}`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums ${
                active
                  ? 'border-accent bg-accent text-ink-950'
                  : done
                    ? 'border-accent/60 text-accent'
                    : 'border-ink-700 text-ink-400'
              }`}
            >
              {done ? '✓' : i + 1}
            </span>
            <span
              className={`truncate ${
                active ? 'font-semibold text-ink-100' : done ? 'text-ink-300' : 'text-ink-400'
              }`}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={`h-px min-w-3 flex-1 ${done ? 'bg-accent/60' : 'bg-ink-700'}`}
              />
            )}
          </li>
        );
      })}
    </ol>
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

/**
 * Asks before something is destroyed. With `typed`, the operator has to type
 * that exact text first: for removals that take other things down with them,
 * a click is too easy to make by reflex.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  typed,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  typed?: string;
  /** resolves when done; a rejection is shown and the dialog stays open */
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const t = useT();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const armed = !typed || value.trim() === typed;

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!armed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={confirm} className="space-y-3">
        <div className="space-y-2 text-xs leading-relaxed text-ink-300">{children}</div>
        {typed && (
          <Field label={fmt(t.ui.confirm.typed, { typed })}>
            <Input
              autoFocus
              autoComplete="off"
              spellCheck={false}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>
        )}
        <ErrorNote>{error}</ErrorNote>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t.ui.confirm.cancel}
          </Button>
          <Button type="submit" variant="danger" disabled={!armed || busy} autoFocus={!typed}>
            {busy ? '…' : confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function PreflightTable({ checks }: { checks: PreflightCheckView[] }) {
  const t = useT();
  return (
    <ul className="space-y-1">
      {checks.map((c) => (
        <li key={c.id} className="flex flex-wrap items-baseline gap-x-2 text-[11px]">
          <span
            className={
              c.ok ? 'text-accent' : c.required ? 'text-danger' : 'text-warn'
            }
          >
            {c.ok
              ? t.ui.preflight.ok
              : c.required
                ? t.ui.preflight.refusedRequired
                : t.ui.preflight.refusedOptional}
          </span>
          <code className="text-ink-300">{c.label}</code>
          {!c.ok && (
            <span className="text-ink-400">
              {c.required ? '' : t.ui.preflight.optionalPrefix}
              {c.why ?? c.note}
            </span>
          )}
          {/* what the host answered: who was refused and why */}
          {!c.ok && c.why && c.note && c.note !== 'AccessDenied' && (
            <span className="basis-full break-words pl-4 text-ink-400">{c.note}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
