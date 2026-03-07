import { type ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`bg-white border border-slate-200 rounded-lg shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: CardProps) {
  return (
    <div className={`px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 ${className}`}>
      {children}
    </div>
  );
}

export function CardContent({ children, className = "" }: CardProps) {
  return <div className={`p-4 sm:p-6 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = "" }: CardProps) {
  return (
    <div className={`px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50 rounded-b-lg ${className}`}>
      {children}
    </div>
  );
}
