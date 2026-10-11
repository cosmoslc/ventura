/** Sahifa sarlavhasi: nom, izoh va o'ngda amallar. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="type-heading text-(length:--page-title-size) leading-tight text-foreground">{title}</h1>
        {description ? <p className="mt-1 text-body text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/** Bo'sh holat: markazda ikonka, sarlavha va izoh. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-6 py-14 text-center">
      <div className="mx-auto mb-3 grid size-12 place-items-center rounded-card border border-border bg-muted text-muted-foreground [&_svg]:size-5">
        {icon}
      </div>
      <div className="type-heading text-title text-foreground">{title}</div>
      {description ? <div className="mt-1 text-body text-muted-foreground">{description}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
