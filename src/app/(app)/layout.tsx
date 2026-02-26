import { NavBar } from "@/components/ui/navbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavBar />
      <main className="max-w-6xl mx-auto px-6 py-8">
        {children}
      </main>
    </>
  );
}
