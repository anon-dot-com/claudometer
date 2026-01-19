import { NavHeader } from "@/components/nav-header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950">
      <NavHeader />
      <main>{children}</main>
    </div>
  );
}
