import { useEffect, useState } from 'react';
import HelloHybrid from './ui/HelloHybrid';
import SourcesPage from './ui/SourcesPage';

const PAGES = {
  '#/sources': { label: 'Data library', step: 'Step 2', render: () => <SourcesPage /> },
  '#/hybrid': { label: 'Hello hybrid', step: 'Step 1', render: () => <HelloHybrid /> },
} as const;
type Route = keyof typeof PAGES;

function currentRoute(): Route {
  return (location.hash in PAGES ? location.hash : '#/sources') as Route;
}

export default function App() {
  const [route, setRoute] = useState<Route>(currentRoute);
  useEffect(() => {
    const onHash = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-lg font-bold tracking-tight text-gray-900">
              Check<span className="text-emerald-700">Visa</span>
            </p>
            <p className="text-xs text-gray-500">The consular officer's checklist, run privately on your laptop.</p>
          </div>
          <nav className="flex gap-1">
            {(Object.keys(PAGES) as Route[]).map((r) => (
              <a
                key={r}
                href={r}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  route === r ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {PAGES[r].step} · {PAGES[r].label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{PAGES[route].render()}</main>
      <footer className="mx-auto max-w-3xl px-4 pb-10 text-xs text-gray-500">
        Pre-check, not legal advice. Open source under Apache-2.0; dataset under CC BY 4.0 with source attribution.
        Built for #BuildHybridAI 2026.
      </footer>
    </div>
  );
}
