import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import AuthPage from './ui/AuthPage';
import AccountPage from './ui/AccountPage';
import { IconUser } from './ui/icons';
import { isAccount, watchUser } from './firebase/auth';
import { loadUserData, saveUserData } from './firebase/userData';
import HelloHybrid from './ui/HelloHybrid';
import SourcesPage, { type Origin } from './ui/SourcesPage';
import AdminPage from './ui/AdminPage';
import { loadLibraryFromFirestore } from './firebase/library';
import TripPage from './ui/TripPage';
import CheckPage from './ui/CheckPage';
import StatsPage from './ui/StatsPage';
import { bundledLibrary } from './core/data/library';
import { defaultTrip, type Trip } from './core/rules/trip';
import { today } from './core/rules/dates';
import { DEFAULT_RATES } from './core/rules/money';
import type { Dossier } from './core/rules/dossier';
import { getFirebase } from './firebase/init';
import { isFirebaseConfigured } from './firebase/config';
import { loadRemoteConfig } from './firebase/remoteConfig';
import { setCloudModel } from './core/ai/modelFactory';

const Landing = lazy(() => import('./landing/Landing'));

type Route = '#/' | '#/trip' | '#/check' | '#/stats' | '#/sources' | '#/hybrid' | '#/admin' | '#/signin' | '#/signup' | '#/account';
const EXTRA: Route[] = ['#/admin', '#/signin', '#/signup', '#/account'];
const NAV: Array<[Route, string]> = [
  ['#/trip', 'My trip'],
  ['#/check', 'Check my dossier'],
  ['#/stats', 'Statistics'],
  ['#/sources', 'Sources'],
  ['#/hybrid', 'AI status'],
];

function currentRoute(): Route {
  if (EXTRA.includes(location.hash as Route)) return location.hash as Route; // not in the main menu
  return (NAV.some(([r]) => r === location.hash) ? location.hash : '#/') as Route;
}

const TRIP_KEY = 'checkvisa.trip.v1';
const CHECKED_KEY = 'checkvisa.checked.v1';

function loadChecked(): string[] {
  try {
    const raw = localStorage.getItem(CHECKED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

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
  const [lib, setLib] = useState(bundledLibrary);
  const [origin, setOrigin] = useState<Origin>('bundle');
  const [rates, setRates] = useState(DEFAULT_RATES);
  const [trip, setTripState] = useState<Trip>(loadTrip);
  // Private document facts: kept in memory only, never written to storage or Firestore.
  const [dossier, setDossier] = useState<Dossier>({});
  // Checklist ticks: not documents, only which items you already have.
  const [checked, setCheckedState] = useState<string[]>(loadChecked);
  const [user, setUser] = useState<User | null>(null);
  const [syncState, setSyncState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const loadedFor = useRef<string | null>(null);
  const setChecked = (ids: string[]) => {
    setCheckedState(ids);
    try {
      localStorage.setItem(CHECKED_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  };

  const setTrip = (t: Trip) => {
    setTripState(t);
    try {
      localStorage.setItem(TRIP_KEY, JSON.stringify(t));
    } catch {
      /* ignore */
    }
  };

  // Exchange rates and the cloud model name come from Remote Config (falls back to defaults).
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const { app, user } = getFirebase();
    loadRemoteConfig(app).then((config) => {
      setRates(config.rates);
      setCloudModel(config.cloudModel);
    });
    // Rules come down: prefer the live Firestore dataset (updatable without redeploy), else the bundled copy.
    user
      .then(() => loadLibraryFromFirestore(app))
      .then((live) => {
        if (live) {
          setLib(live);
          setOrigin('firestore');
        }
      })
      .catch((e) => console.warn('[CheckVisa] Using the bundled dataset:', e));
  }, []);

  // Accounts: when a real account signs in, its saved trip and ticks come down; later changes go up.
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    getFirebase();
    return watchUser((u) => {
      setUser(u);
      if (!isAccount(u)) {
        loadedFor.current = null;
        return;
      }
      loadUserData(getFirebase().app, u.uid)
        .then((saved) => {
          if (saved?.trip) setTrip({ ...defaultTrip(today()), ...saved.trip });
          if (saved?.checked) setChecked(saved.checked);
        })
        .catch((e) => console.warn('[CheckVisa] Could not load the saved checklist:', e))
        .finally(() => (loadedFor.current = u.uid));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isAccount(user) || loadedFor.current !== user.uid) return;
    setSyncState('saving');
    const t = setTimeout(() => {
      saveUserData(getFirebase().app, user.uid, { trip, checked })
        .then(() => setSyncState('saved'))
        .catch(() => setSyncState('error'));
    }, 800);
    return () => clearTimeout(t);
  }, [user, trip, checked]);

  useEffect(() => {
    const onHash = () => {
      setRoute(currentRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const pages: Record<Route, () => ReactNode> = {
    '#/trip': () => <TripPage trip={trip} setTrip={setTrip} lib={lib} rates={rates} checked={checked} setChecked={setChecked} />,
    '#/check': () => <CheckPage trip={trip} setTrip={setTrip} dossier={dossier} setDossier={setDossier} lib={lib} rates={rates} />,
    '#/stats': () => <StatsPage lib={lib} />,
    '#/sources': () => <SourcesPage lib={lib} origin={origin} />,
    '#/hybrid': () => <HelloHybrid />,
    '#/admin': () => <AdminPage />,
    '#/': () => null,
    '#/signin': () => <AuthPage mode="signin" />,
    '#/signup': () => <AuthPage mode="signup" />,
    '#/account': () => <AccountPage user={user} trip={trip} checked={checked} syncState={syncState} />,
  };

  if (route === '#/') {
    return (
      <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0f1f10' }} />}>
        <Landing lib={lib} onPickDestination={(destination) => { setTrip({ ...trip, destination }); location.hash = '#/trip'; }} />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-2 px-4 py-4 sm:px-8">
          <a href="#/" className="text-[1.45rem] font-semibold tracking-[-0.02em] text-gray-900">
            CheckVisa
          </a>
            <a
            href={isAccount(user) ? '#/account' : '#/signin'}
            className={`order-2 sm:order-3 inline-flex items-center gap-2 px-3 py-1.5 transition-colors ${isAccount(user) ? 'bg-gray-100 text-gray-900 hover:bg-gray-200' : 'bg-stamp font-semibold text-white hover:bg-stamp-dark'}`}
          >
            <IconUser size={16} />
            {isAccount(user) ? (user.displayName?.split(' ')[0] ?? 'Account') : 'Sign in'}
          </a>
          <nav className="order-3 -mx-4 flex w-[calc(100%+2rem)] items-center gap-x-6 overflow-x-auto px-4 text-[15px] whitespace-nowrap [scrollbar-width:none] sm:order-2 sm:mx-0 sm:ml-auto sm:w-auto sm:px-0" aria-label="Main">
            {NAV.map(([r, label]) => (
              <a
                key={r}
                href={r}
                aria-current={route === r ? 'page' : undefined}
                className={`relative py-1 transition-colors ${route === r ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
              >
                {label}
                <span className={`absolute inset-x-0 -bottom-0.5 h-0.5 origin-left bg-uv transition-transform duration-300 ${route === r ? 'scale-x-100' : 'scale-x-0'}`} />
              </a>
            ))}

          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8 sm:py-14">{pages[route]()}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-12 text-sm text-gray-500 sm:px-8">
        A pre-check, not legal advice. Your documents are read on this device and never stored. Open source under Apache-2.0; dataset under CC BY 4.0
        with source attribution.
      </footer>
    </div>
  );
}
