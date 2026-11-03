export default function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md py-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-extrabold">{title}</h1>
        {subtitle && <p className="mt-1 mb-5 text-sm text-gray-600">{subtitle}</p>}
        {!subtitle && <div className="mb-5" />}
        {children}
      </div>
    </div>
  );
}
