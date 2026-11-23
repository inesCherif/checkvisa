import { useEffect, useState } from 'react';
import { getFirebase, isLocalhost } from '../firebase/init';
import { firebaseConfig, isFirebaseConfigured, missingConfigKeys } from '../firebase/config';
import { askDemo, type AskResult } from '../core/ai/ask';
import { getModel } from '../core/ai/modelFactory';
import { checkOnDeviceStatus, ON_DEVICE_STATUS_TEXT, type OnDeviceStatus } from '../core/ai/onDevice';
import { describeSource, ROUTING_TABLE, type DataClass } from '../core/routing/policy';

const DEFAULT_PROMPT =
  'In two short sentences, explain why a Schengen visa application needs travel medical insurance of at least EUR 30,000.';

export default function HelloHybrid() {
  if (!isFirebaseConfigured()) return <SetupNeeded missing={missingConfigKeys()} />;
  return <HybridPlayground />;
}

function errorText(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (/app.?check|attestation|appCheck/i.test(text) && isLocalhost()) {
    return `${text}\n\nHint: open DevTools → Console, copy the "App Check debug token", and register it in Firebase console → App Check → Apps → Manage debug tokens.`;
  }
  return text;
}

function HybridPlayground() {
  const [{ ai, user }] = useState(() => getFirebase());
  const [uid, setUid] = useState<string>();
  const [authError, setAuthError] = useState<string>();
  const [status, setStatus] = useState<OnDeviceStatus>();
  const [progress, setProgress] = useState<number | null>(null);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [forceCloud, setForceCloud] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AskResult>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    user.then((u) => setUid(u.uid)).catch((e) => setAuthError(errorText(e)));
  }, [user]);

  useEffect(() => {
    void checkOnDeviceStatus().then(setStatus);
  }, []);

  // Must run on a user click: Chrome only allows the model download after a user gesture.
  async function prepareNano() {
    setError(undefined);
    setProgress(0);
    try {
      await getModel(ai, 'prefer_on_device').initializeDeviceModel((value) => setProgress(value));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setProgress(null);
      setStatus(await checkOnDeviceStatus());
    }
  }

  async function onAsk() {
    setBusy(true);
    setError(undefined);
    setResult(undefined);
    try {
      setResult(await askDemo(ai, prompt, forceCloud));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      setStatus(await checkOnDeviceStatus());
    }
  }

  const onDevice = result?.source === 'on_device';

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2">
        <StatusTile label="Firebase project" value={firebaseConfig.projectId} ok />
        <StatusTile
          label="App Check"
          value={
            !isFirebaseConfigured() || !getFirebase().appCheck
              ? 'Off (no site key)'
              : isLocalhost()
                ? 'Debug token (localhost)'
                : 'reCAPTCHA Enterprise'
          }
          ok={isFirebaseConfigured() && getFirebase().appCheck !== null}
        />
        <StatusTile
          label="Signed in (anonymous)"
          value={authError ? authError : uid ? `uid ${uid.slice(0, 8)}…` : 'signing in…'}
          ok={!!uid}
          bad={!!authError}
        />
        <div className=" bg-white p-4">
          <p className="text-[13px] font-medium text-gray-500">On-device model</p>
          <p className="mt-1 text-sm text-gray-900">{status ? ON_DEVICE_STATUS_TEXT[status] : 'checking…'}</p>
          {(status === 'downloadable' || status === 'downloading') && progress === null && (
            <button
              onClick={prepareNano}
              className="mt-3 bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
            >
              Prepare Gemini Nano
            </button>
          )}
          {progress !== null && (
            <div className="mt-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div className="h-full bg-emerald-600 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <p className="mt-1 text-[13px] text-gray-500">Downloading… {Math.round(progress * 100)}%</p>
            </div>
          )}
        </div>
      </section>

      <section className=" bg-white p-5">
        <label htmlFor="prompt" className="text-sm font-semibold text-gray-900">
          Ask anything
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className="mt-2 w-full border border-gray-300 p-3 text-sm focus:border-gray-900 focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={forceCloud}
              onChange={(e) => setForceCloud(e.target.checked)}
              className="h-4 w-4 accent-gray-900"
            />
            Force cloud (simulate a device without Gemini Nano)
          </label>
          <button
            onClick={onAsk}
            disabled={busy || !prompt.trim()}
            className=" bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40"
          >
            {busy ? 'Thinking…' : 'Ask'}
          </button>
        </div>
      </section>

      {error && (
        <pre className="whitespace-pre-wrap border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</pre>
      )}

      {result && (
        <section className=" bg-white p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-3 py-1 text-[13px] font-semibold ${
                onDevice ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
              }`}
            >
              {describeSource(result.source, result.mode)}
            </span>
            <span className="text-[13px] text-gray-500">
              mode <code>{result.mode}</code> · {result.ms} ms
              {!onDevice && <> · model <code>{result.cloudModel}</code></>}
            </span>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-900">{result.text}</p>
        </section>
      )}

      <RoutingTable />
    </div>
  );
}

function StatusTile({ label, value, ok, bad }: { label: string; value: string; ok?: boolean; bad?: boolean }) {
  return (
    <div className=" bg-white p-4">
      <p className="text-[13px] font-medium text-gray-500">{label}</p>
      <p className={`mt-1 break-words text-sm ${bad ? 'text-red-700' : ok ? 'text-gray-900' : 'text-gray-500'}`}>{value}</p>
    </div>
  );
}

const MODE_LABEL: Record<string, string> = {
  only_on_device: 'Only on this device',
  prefer_on_device: 'On this device first, cloud fallback',
  prefer_in_cloud: 'Cloud first, on-device when offline',
  only_in_cloud: 'Cloud only',
};

function RoutingTable() {
  const rows = (Object.keys(ROUTING_TABLE) as DataClass[]).filter((d) => d !== 'DEMO');
  return (
    <section className=" bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-900">How CheckVisa routes AI calls</h2>
      <p className="mt-1 text-[13px] text-gray-500">Rules come down, documents never go up.</p>
      <table className="mt-3 w-full text-left text-sm">
        <tbody>
          {rows.map((dataClass) => (
            <tr key={dataClass} className="border-t border-gray-100 align-top">
              <td className="py-2 pr-3 font-mono text-[13px] text-gray-700">{dataClass}</td>
              <td className="py-2 pr-3 text-gray-900">{MODE_LABEL[ROUTING_TABLE[dataClass].defaultMode]}</td>
              <td className="py-2 text-gray-600">{ROUTING_TABLE[dataClass].why}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SetupNeeded({ missing }: { missing: string[] }) {
  return (
    <section className=" border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
      <h2 className="font-semibold">Firebase is not configured yet</h2>
      <p className="mt-2">
        Copy <code>.env.example</code> to <code>.env.local</code> and fill in these values from your Firebase project
        (see README → Setup):
      </p>
      <ul className="mt-2 list-inside list-disc font-mono text-[13px]">
        {missing.map((key) => (
          <li key={key}>{key}</li>
        ))}
      </ul>
    </section>
  );
}
