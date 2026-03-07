import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reimbursement Request Manager",
  description: "Reimbursement request workflow",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 min-h-screen font-sans text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
