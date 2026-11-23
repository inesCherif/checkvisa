import { useEffect, useState, type ReactNode } from 'react';
import HelloHybrid from './ui/HelloHybrid';
import SourcesPage from './ui/SourcesPage';
import TripPage from './ui/TripPage';
import CheckPage from './ui/CheckPage';
import { bundledLibrary } from './core/data/library';
import { defaultTrip, type Trip } from './core/rules/trip';
import { today } from './core/rules/dates';
import { DEFAULT_RATES } from './core/rules/money';
import type { Dossier } from './core/rules/dossier';

type Route = '#/trip' | '#/check' | '#/sources' | '#/hybrid';
const NAV: Array<[Route, string]> = [
  ['#/trip', '1 · My trip'],
  ['#/check', '2 · Check my dossier'],
  ['#/sources', 'Sources'],
  ['#/hybrid', 'AI status'],
];

function currentRoute(): Route {
  return (NAV.some(([r]) => r === location.hash) ? location.hash : '#/trip') as Route;
}

const TRIP_KEY = 'checkvisa.trip.v1';

function loadTrip(): Trip {
  try {
    const raw = localStorage.getItem(TRIP_KEY);
    if (raw) return { ...defaultTrip(today()), ...JSON.parse(raw) };
  } catch {
    /* storage unavailable */
  }
  return defaultTrip(today());
}

export default function App() {
  const [route, setRoute] = useState<Route>(currentRoute);
  const [lib] = useState(bundledLibrary);
  const [rates] = useState(DEFAULT_RATES);
  const [trip, setTripState] = useState<Trip>(loadTrip);
  // Private document facts: kept in memory only, never written to storage or Firestore.
  const [dossier, setDossier] = useState<Dossier>({});

  const setTrip = (t: Trip) => {
    setTripState(t);
    try {
      localStorage.setItem(TRIP_KEY, JSON.stringify(t));
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const onHash = () => {
      setRoute(currentRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const pages: Record<Route, () => ReactNode> = {
    '#/trip': () => <TripPage trip={trip} setTrip={setTrip} lib={lib} rates={rates} />,
    '#/check': () => <CheckPage trip={trip} setTrip={setTrip} dossier={dossier} setDossier={setDossier} lib={lib} rates={rates} />,
    '#/sources': () => <SourcesPage />,
    '#/hybrid': () => <HelloHybrid />,
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <a href="#/trip" className="block">
            <p className="text-lg font-extrabold tracking-tight text-gray-900">
              Check<span className="text-emerald-700">Visa</span>
            </p>
            <p className="text-[11px] text-gray-500">Rules come down, documents never go up.</p>
          </a>
          <nav className="flex flex-wrap gap-1">
            {NAV.map(([r, label]) => (
              <a
                key={r}
                href={r}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  route === r ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{pages[route]()}</main>
      <footer className="mx-auto max-w-4xl px-4 pb-10 text-xs text-gray-500">
        Pre-check, not legal advice. Your documents are read on this device and never stored. Open source under
        Apache-2.0; dataset under CC BY 4.0 with source attribution. Built for #BuildHybridAI 2026.
      </footer>
    </div>
  );
}
