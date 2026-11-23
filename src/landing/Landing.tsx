// CheckVisa landing page: "the dark room".
// The hero is the product's one live thing: a UV lamp over a specimen dossier. The problems it reveals
// are computed right here by the app's real rule engine (runChecks) on the app's sample applicant.

import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import './landing.css';
import UvLampScene, { type HoverInfo } from './UvLampScene';
import { buildDossier, type DocId } from './dossierTextures';
import { sampleDossier } from '../core/sample/sampleDossier';
import { runChecks } from '../core/rules/checks';
import { bundledLibrary, type Library } from '../core/data/library';
import { DEFAULT_RATES } from '../core/rules/money';
import { today } from '../core/rules/dates';
import { statsByState } from '../core/data/stats';
import { DESTINATIONS, type Destination } from '../core/rules/trip';

gsap.registerPlugin(ScrollTrigger);

interface Props {
  lib?: Library;
  onPickDestination: (d: Destination) => void;
}

const Arrow = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M4 12h15M13 6l6 6-6 6" />
  </svg>
);

export default function Landing({ lib: libProp, onPickDestination }: Props) {
  const lib = useMemo(() => libProp ?? bundledLibrary(), [libProp]);
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  // The sample applicant, checked by the real engine. Timed, because the speed is part of the story.
  const { docs, findings, ms } = useMemo(() => {
    const sample = sampleDossier(today());
    const t0 = performance.now();
    const all = runChecks(sample.dossier, { trip: sample.trip, lib, applicationDate: sample.applicationDate, rates: DEFAULT_RATES });
    const ms = Math.max(1, Math.round(performance.now() - t0));
    return { docs: buildDossier(sample, all), findings: all.filter((f) => f.status === 'fail'), ms };
  }, [lib]);

  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [found, setFound] = useState<DocId[]>([]);
  const total = docs.filter((d) => d.finding).length;

  const stats = useMemo(() => {
    const { years, states } = statsByState(lib.stats);
    const y = years[years.length - 1];
    const rows = states.slice(0, 10).map((s) => ({ name: s.state, rate: s.byYear[y]?.rate ?? 0 }));
    const max = Math.max(...rows.map((r) => r.rate));
    const file = lib.stats.find((f) => f.year === y);
    return { year: y, rows, max, applied: file?.totals.applied ?? 0, notIssued: file?.totals.notIssued ?? 0 };
  }, [lib]);

  const passportFinding = findings.find((f) => f.id === 'passport.validity');
  const passportFact = lib.facts.find((f) => f.id === 'passport.validity-after-exit');

  // Smooth scroll + scroll-linked motion, all torn down when leaving the page.
  useEffect(() => {
    const root = rootRef.current!;
    root.classList.add('js');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const prevBg = document.body.style.background;
    document.body.style.background = '#0f1f10';
    if (reduce) return () => void (document.body.style.background = prevBg);

    const lenis = new Lenis({ lerp: 0.11 });
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const ctx = gsap.context(() => {
      gsap.from('.lp-hero-copy > *', { opacity: 0, y: 28, duration: 1.1, stagger: 0.09, delay: 0.5, ease: 'expo.out' });
      gsap.from('.lp-nav > *', { opacity: 0, y: -12, duration: 0.9, stagger: 0.06, delay: 0.3, ease: 'expo.out' });

      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
        gsap.to(el.children, {
          opacity: 1,
          y: 0,
          duration: 0.95,
          stagger: 0.08,
          ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 84%', once: true },
        });
      });

      gsap.utils.toArray<HTMLElement>('.lp-photo-frame img').forEach((img) => {
        gsap.fromTo(img, { yPercent: -7 }, { yPercent: 7, ease: 'none', scrollTrigger: { trigger: img, scrub: true } });
      });

      const counter = root.querySelector<HTMLElement>('[data-count]');
      if (counter) {
        const target = Number(counter.dataset.count);
        const o = { v: 0 };
        gsap.to(o, {
          v: target,
          duration: 2.2,
          ease: 'power3.out',
          scrollTrigger: { trigger: counter, start: 'top 80%', once: true },
          onUpdate: () => (counter.textContent = Math.round(o.v).toLocaleString('en-GB')),
        });
      }

      gsap.from('.lp-bar-fill', {
        scaleY: 0,
        duration: 1.2,
        stagger: 0.05,
        ease: 'expo.out',
        scrollTrigger: { trigger: '.lp-bars', start: 'top 82%', once: true },
      });

      gsap.fromTo(
        '.lp-wordmark',
        { scale: 0.55 },
        { scale: 1, ease: 'none', scrollTrigger: { trigger: '.lp-foot', start: 'top bottom', end: 'bottom bottom', scrub: true } },
      );
    }, root);

    return () => {
      ctx.revert();
      gsap.ticker.remove(tick);
      lenis.destroy();
      document.body.style.background = prevBg;
    };
  }, []);

  // The lamp's cursor dot.
  useEffect(() => {
    const hero = heroRef.current!;
    const ring = ringRef.current!;
    const move = (e: PointerEvent) => {
      const r = hero.getBoundingClientRect();
      ring.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top}px)`;
      ring.style.opacity = '1';
    };
    const leave = () => (ring.style.opacity = '0');
    hero.addEventListener('pointermove', move);
    hero.addEventListener('pointerleave', leave);
    return () => {
      hero.removeEventListener('pointermove', move);
      hero.removeEventListener('pointerleave', leave);
    };
  }, []);

  const hoveredDoc = hover ? docs.find((d) => d.id === hover.id) : undefined;
  const hf = hoveredDoc?.finding;
  const hfFact = hf ? lib.facts.find((f) => f.id === (hf.refusalReason ? `refusal.${hf.refusalReason}` : hf.factIds[0])) : undefined;
  const hfSource = hfFact ? lib.sourceById.get(hfFact.sourceId) : undefined;
  const noteLeft = hover ? hover.x > (heroRef.current?.clientWidth ?? 0) * 0.62 : false;

  const allFound = found.length >= total && total > 0;
  const pct = Math.round((stats.notIssued / stats.applied) * 100);

  return (
    <div className="lp" ref={rootRef}>
      <nav className="lp-nav" aria-label="Main">
        <a href="#/" className="lp-word">
          CheckVisa
        </a>
        <ul>
          <li>
            <a href="#how">How it works</a>
          </li>
          <li>
            <a href="#numbers">The numbers</a>
          </li>
          <li>
            <a href="#questions">Questions</a>
          </li>
        </ul>
        <a href="#/trip" className="lp-btn">
          Open the app
        </a>
      </nav>

      <header className="lp-hero" ref={heroRef}>
        <UvLampScene
          docs={docs}
          eventSource={heroRef}
          onHover={setHover}
          onFound={(id) => setFound((f) => (f.includes(id) ? f : [...f, id]))}
        />
        <div className="lp-ring" ref={ringRef} style={{ opacity: 0 }} />

        <div className="lp-hero-copy">
          <h1>
            Check your dossier like the consulate will.
          </h1>
          <div className="lp-hero-side">
          <p>
            Hold the lamp over this sample dossier. The problems it shows are the ones that get applications refused in Tunisia, and CheckVisa finds
            them on your laptop without uploading a page.
          </p>
          <a href="#/trip" className="lp-btn">
            Check my own dossier <Arrow />
          </a>
          </div>
        </div>

        <div className="lp-tally" aria-live="polite">
          <strong>
            <span>{found.length}</span> of {total}
          </strong>
          {allFound
            ? `All found. The rule engine flagged them in ${ms} ms, on this device.`
            : found.length === 0
              ? 'problems found. Move the lamp over the documents.'
              : 'problems found. Keep looking.'}
        </div>

        {hover && hf && (
          <div key={hover.id} className={`lp-note${noteLeft ? ' left' : ''}`} style={{ left: hover.x, top: hover.y }} role="status">
            <b>{hf.title}</b>
            <p>{hf.detail}</p>
            {hfFact && (
              <small>
                {hfSource?.id === 'eu-visa-code' || hfFact.locator.startsWith('Art') ? 'EU Visa Code, ' : ''}
                {hfFact.locator}
              </small>
            )}
          </div>
        )}
      </header>

      <section className="lp-intro" aria-labelledby="intro-title">
        <div className="lp-intro-text" data-reveal>
          <h2 id="intro-title" className="lp-num" data-count={stats.notIssued}>
            {stats.notIssued.toLocaleString('en-GB')}
          </h2>
          <p className="lp-statement">Schengen visa applications lodged in Tunisia were not issued in {stats.year}.</p>
          <p>
            That is about one in {Math.round(100 / pct)} of the {stats.applied.toLocaleString('en-GB')} people who queued, paid the non-refundable
            €90 fee and waited. Many were missing a single page.
          </p>
        </div>
        <div className="lp-photos">
          <figure className="lp-photo" data-reveal>
            <div className="lp-photo-frame">
              <img src="/img/bab-bhar-photo-2.jpg" width={1920} height={1280} alt="The stone arch of Bab el Bhar, the old sea gate between the medina and the modern city of Tunis" loading="lazy" decoding="async" />
            </div>
            <figcaption>Bab el Bhar, the old sea gate of Tunis.</figcaption>
          </figure>
          <figure className="lp-photo" data-reveal>
            <div className="lp-photo-frame">
              <img src="/img/aeroport-international-de-tunis-carthage-2019.jpg" width={1920} height={1440} alt="Tunis-Carthage airport terminal under a clear summer sky" loading="lazy" decoding="async" />
            </div>
            <figcaption>Tunis-Carthage, where most trips begin.</figcaption>
          </figure>
          <figure className="lp-photo" data-reveal>
            <div className="lp-photo-frame">
              <img src="/img/tunisia-ferries-tunis.jpg" width={1920} height={968} alt="A Tunisia Ferries ship moored in the port of La Goulette, seen from the air" loading="lazy" decoding="async" />
            </div>
            <figcaption>La Goulette, the ferry to Marseille and Genoa.</figcaption>
          </figure>
          <figure className="lp-photo" data-reveal>
            <div className="lp-photo-frame">
              <img src="/img/01996-avenue-habib-bourguiba-of-tunis.jpg" width={1536} height={1024} alt="Avenue Habib Bourguiba in Tunis, with palm trees and the Ibn Khaldoun statue" loading="lazy" decoding="async" />
            </div>
            <figcaption>Avenue Habib Bourguiba, a few streets from the consulates.</figcaption>
          </figure>
        </div>
      </section>

      <section className="lp-rules" id="how" aria-label="How CheckVisa works">
        <div className="lp-rule" data-reveal>
          <h2>Rules come down.</h2>
          <p>
            The cloud does one job: it compiles public rules. The EU Visa Code, the EU list of documents for Tunisia, each consulate's checklist, the
            central bank's exchange rates. Every rule keeps its source and its exact words.
          </p>
        </div>
        <div className="lp-rule is-alt" data-reveal>
          <h2>Documents never go up.</h2>
          <p>
            Your passport, payslips and bank statements are read by Gemini Nano inside Chrome, on this laptop. A ledger lists every AI call, and
            checking the sample dossier makes none to the cloud.
          </p>
        </div>
        <div className="lp-rule" data-reveal>
          <h2>You decide the rest.</h2>
          <p>
            No Gemini Nano on your machine? Type the fields yourself, or tick a box to let the cloud read one document. Nothing leaves before you tick
            it.
          </p>
        </div>
      </section>

      {passportFinding && (
        <section className="lp-show" aria-labelledby="show-title">
          <div data-reveal>
            <h2 id="show-title">Every answer quotes the law.</h2>
            <p className="lead">
              A result is never just a red light. It says what is wrong, how to fix it before you pay the fee, and which article of which regulation
              says so.
            </p>
          </div>
          <div data-reveal>
            <article className="lp-card" data-ui>
              <div className="lp-card-head">
                <span className="lp-card-mark" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="m6 6 12 12M18 6 6 18" />
                  </svg>
                </span>
                <div>
                  <h3>{passportFinding.title}</h3>
                  <p className="detail">{passportFinding.detail}</p>
                </div>
              </div>
              {passportFinding.fix && <p className="fix">{passportFinding.fix}</p>}
              {passportFact && (
                <blockquote>
                  “{passportFact.quote}”<cite>EU Visa Code, {passportFact.locator} · Regulation (EC) No 810/2009</cite>
                </blockquote>
              )}
              <div className="badges">
                <span>Read on this device · Gemini Nano</span>
                <span>0 cloud calls</span>
              </div>
            </article>
          </div>
        </section>
      )}

      <section className="lp-proof" aria-labelledby="proof-title">
        <h2 id="proof-title" data-reveal>
          <span>Where the rules come from</span>
        </h2>
        <div data-reveal>
          <p>
            EU law from the <b>EU Publications Office</b>, statistics from the <b>European Commission</b>, checklists from <b>France</b>, <b>Italy</b>,{' '}
            <b>Germany</b>, <b>Spain</b>, <b>Belgium</b>, <b>the Netherlands</b> and <b>Switzerland</b>, rates from the <b>Banque Centrale de Tunisie</b>.
          </p>
        </div>
      </section>

      <section className="lp-stats" id="numbers" aria-labelledby="stats-title">
        <div className="lp-stats-head" data-reveal>
          <h2 id="stats-title">Refusals differ by consulate.</h2>
          <p>
            Share of short-stay applications not issued by each country's consulates in Tunisia, {stats.year}, for the ten busiest. Source: European
            Commission visa statistics.
          </p>
        </div>
        <div className="lp-bars" role="list">
          {stats.rows.map((r) => (
            <div key={r.name} className={`lp-bar${r.rate === stats.max ? ' is-max' : ''}`} role="listitem">
              <div className="lp-bar-fill" style={{ height: `${(r.rate / stats.max) * 100}%` }}>
                {Math.round(r.rate * 100)}%
              </div>
              <div className="lp-bar-name">{r.name}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-faq" id="questions" aria-labelledby="faq-title">
        <h2 id="faq-title" data-reveal>
          <span>Questions</span>
        </h2>
        {[
          ['Does my passport get uploaded?', 'No. Gemini Nano reads your documents on your device and keeps them in memory only; closing the tab forgets them. The online database holds public rules and nothing else.'],
          ['What do I need?', 'Chrome on a laptop with Gemini Nano works best. Without it you can type the fields by hand, or allow the cloud to read a single document.'],
          ['Which visas and countries?', `Short-stay Schengen visas (type C) for people applying in Tunisia, with checklists for ${Object.values(DESTINATIONS).join(', ')}.`],
          ['Is this legal advice?', 'No. It is a pre-check against published rules; the consulate decides. Checklists change, so every rule shows the day it was retrieved.'],
        ].map(([q, a]) => (
          <div className="lp-qa" key={q} data-reveal>
            <h3>{q}</h3>
            <p>{a}</p>
          </div>
        ))}
      </section>

      <section className="lp-cta" aria-labelledby="cta-title">
        <div data-reveal>
          <h2 id="cta-title">Where are you going?</h2>
          <p>Pick the country of your main stay. Your checklist opens with its rules.</p>
        </div>
        <div className="lp-dest" data-reveal>
          {(Object.entries(DESTINATIONS) as Array<[Destination, string]>).map(([code, name]) => (
            <button key={code} type="button" onClick={() => onPickDestination(code)}>
              {name}
            </button>
          ))}
        </div>
      </section>

      <footer className="lp-foot">
        <div className="lp-foot-cols">
          <div>
            <h3>CheckVisa</h3>
            <p>A private pre-check of Schengen visa dossiers for applicants in Tunisia. Not legal advice; not affiliated with any consulate or visa centre.</p>
          </div>
          <div>
            <h3>The app</h3>
            <ul>
              <li>
                <a href="#/trip">My trip</a>
              </li>
              <li>
                <a href="#/check">Check my dossier</a>
              </li>
              <li>
                <a href="#/stats">Statistics</a>
              </li>
              <li>
                <a href="#/sources">Sources</a>
              </li>
              <li>
                <a href="#/hybrid">AI status</a>
              </li>
            </ul>
          </div>
          <div>
            <h3>Project</h3>
            <ul>
              <li>
                <a href="https://github.com/inesCherif/checkvisa">Source code</a>
              </li>
              <li>Apache-2.0</li>
              <li>Dataset CC BY 4.0</li>
              <li>#BuildHybridAI 2026</li>
            </ul>
          </div>
          <div>
            <h3>Pictures</h3>
            <p>
              <a href="https://commons.wikimedia.org/wiki/File:A%C3%A9roport_international_de_Tunis-Carthage,_2019.jpg">Tunis-Carthage airport</a> by
              Mohatatou, <a href="https://creativecommons.org/licenses/by-sa/4.0">CC BY-SA 4.0</a>;{' '}
              <a href="https://commons.wikimedia.org/wiki/File:Tunisia_ferries,_Tunis.jpg">Tunisia ferries, Tunis</a> by Tsaag Valren,{' '}
              <a href="https://creativecommons.org/licenses/by-sa/4.0">CC BY-SA 4.0</a>;{' '}
              <a href="https://commons.wikimedia.org/wiki/File:01996_Avenue_Habib_Bourguiba_of_Tunis.jpg">Avenue Habib Bourguiba</a> by Silar, CC0;{' '}
              <a href="https://commons.wikimedia.org/wiki/File:Bab_Bhar_photo_2_%D8%A8%D8%A7%D8%A8_%D8%A7%D9%84%D8%A8%D8%AD%D8%B1.jpg">Bab Bhar</a> by Sami Mlouhi,{' '}
              <a href="https://creativecommons.org/licenses/by-sa/4.0">CC BY-SA 4.0</a>. All via
              Wikimedia Commons. The dossier is a specimen drawn in code.
            </p>
          </div>
        </div>
        <p className="lp-wordmark" aria-hidden="true">
          CheckVisa
        </p>
      </footer>
    </div>
  );
}
