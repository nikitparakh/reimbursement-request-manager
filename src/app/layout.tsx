import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reimbursement Request Manager",
  description: "Reimbursement request workflow",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background min-h-screen font-sans text-foreground antialiased">
        {children}
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}
