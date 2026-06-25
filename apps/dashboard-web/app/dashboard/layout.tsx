import { NavLinks } from "./NavLinks";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r border-slate-200 bg-white p-6">
        <h1 className="mb-8 text-lg font-bold">AD BOT</h1>
        <NavLinks />
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
