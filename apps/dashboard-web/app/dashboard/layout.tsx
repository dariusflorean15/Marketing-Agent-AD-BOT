import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r border-slate-200 bg-white p-6">
        <h1 className="mb-8 text-lg font-bold">AD BOT</h1>
        <nav className="flex flex-col gap-2 text-sm">
          <Link
            href="/dashboard"
            className="rounded px-3 py-2 hover:bg-slate-100"
          >
            Overview
          </Link>
          <Link
            href="/dashboard/chat-analyst"
            className="rounded px-3 py-2 hover:bg-slate-100"
          >
            Chat Analyst
          </Link>
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
