import type { ReactNode } from "react";

export function PageHeader({
  title,
  eyebrow,
  description,
  action
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? <p className="text-sm font-semibold uppercase tracking-normal text-signal">{eyebrow}</p> : null}
        <h1 className="mt-1 text-3xl font-bold tracking-normal">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
