import { DocsSidebar } from './_lib/sidebar';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[210px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto">
        <DocsSidebar />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
