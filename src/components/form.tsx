"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  className = "",
  name,
  value,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  const variantClass =
    variant === "danger" ? "btn-danger" : variant === "secondary" ? "btn-secondary" : "btn-primary";

  return (
    <button type="submit" disabled={pending} name={name} value={value} className={`${variantClass} ${className}`}>
      {pending ? (pendingLabel ?? "Saving…") : children}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-bad/30 bg-bad-soft px-3 py-2 text-sm font-medium text-bad">
      {message}
    </p>
  );
}

export function FormSuccess({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="status" className="rounded-lg border border-good/30 bg-good-soft px-3 py-2 text-sm font-medium text-good">
      {message}
    </p>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className = "",
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`field ${props.className ?? ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={`field ${props.className ?? ""}`} />;
}

export function Select({
  options,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select {...props} className={`field ${props.className ?? ""}`}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** Currency input with a leading symbol; submits a plain decimal string. */
export function MoneyInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-faint">$</span>
      <input
        inputMode="decimal"
        step="0.01"
        min="0"
        type="number"
        {...props}
        className={`field pl-7 ${props.className ?? ""}`}
      />
    </div>
  );
}

export function CheckboxField({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-raised px-3 py-2.5">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

export function FormSection({
  title,
  description,
  children,
  defaultOpen = true,
  collapsible = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
}) {
  const body = (
    <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">{children}</div>
  );

  if (!collapsible) {
    return (
      <section className="card overflow-hidden">
        <div className="px-5 pb-4 pt-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-ink">{title}</h3>
          {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
        </div>
        {body}
      </section>
    );
  }

  return (
    <details className="card overflow-hidden" open={defaultOpen}>
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-bold uppercase tracking-wide text-ink marker:content-['']">
        <span className="flex items-center justify-between gap-2">
          <span>
            {title}
            {description ? <span className="ml-2 text-xs font-normal normal-case tracking-normal text-muted">{description}</span> : null}
          </span>
          <span className="text-muted" aria-hidden>
            ▾
          </span>
        </span>
      </summary>
      {body}
    </details>
  );
}
