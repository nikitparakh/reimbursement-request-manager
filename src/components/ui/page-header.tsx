import { type ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  badge?: ReactNode;
  action?: ReactNode;
};

export function PageHeader({ title, description, badge, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{title}</h1>
          {badge}
        </div>
        {description ? (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
