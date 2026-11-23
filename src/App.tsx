import HelloHybrid from './ui/HelloHybrid';

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-lg font-bold tracking-tight text-gray-900">
              Check<span className="text-emerald-700">Visa</span>
            </p>
            <p className="text-xs text-gray-500">The consular officer's checklist, run privately on your laptop.</p>
          </div>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">Step 1 · Hello hybrid</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <HelloHybrid />
      </main>
      <footer className="mx-auto max-w-3xl px-4 pb-10 text-xs text-gray-500">
        Pre-check, not legal advice. Open source under Apache-2.0. Built for #BuildHybridAI 2026.
      </footer>
    </div>
  );
}
