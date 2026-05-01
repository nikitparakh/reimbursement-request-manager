export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh place-items-center bg-background px-4 py-8 text-foreground antialiased">
      {children}
    </div>
  );
}
