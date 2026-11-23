// CheckVisa landing page: "the dark room".
// The hero is the product's one live thing: a UV lamp over a specimen dossier. The problems it reveals
// are computed right here by the app's real rule engine (runChecks) on the app's sample applicant.

import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import './landing.css';
import UvLampScene, { type CursorMode, type HoverInfo, type SceneControl } from './UvLampScene';
import { buildDossier, type DocId } from './dossierTextures';
import PassportTimeline from './PassportTimeline';
import { sampleDossier } from '../core/sample/sampleDossier';
import { runChecks } from '../core/rules/checks';
import { bundledLibrary, type Library } from '../core/data/library';
import { DEFAULT_RATES } from '../core/rules/money';
import { today } from '../core/rules/dates';
import { statsByState } from '../core/data/stats';
import { DESTINATIONS, type Destination } from '../core/rules/trip';

gsap.registerPlugin(ScrollTrigger, SplitText);

interface Props {
  lib?: Library;
  onPickDestination: (d: Destination) => void;
}

const Arrow = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M4 12h15M13 6l6 6-6 6" />
  </svg>
);

const JOURNEY = [
  {
    img: '/img/bab-bhar-photo-2.jpg',
    w: 1920,
    h: 1280,
    alt: 'The stone arch of Bab el Bhar, the old sea gate between the medina and the modern city of Tunis',
    title: 'Bab el Bhar',
    text: 'The old sea gate. A visa starts in the city: certificates, stamps, translations, signatures.',
  },
  {
    img: '/img/01996-avenue-habib-bourguiba-of-tunis.jpg',
    w: 1536,
    h: 1024,
    alt: 'Avenue Habib Bourguiba in Tunis, with palm trees and the Banque de Tunisie building',
    title: 'Avenue Habib Bourguiba',
    text: 'Banks, insurers and travel agents print the papers a consular officer will read line by line.',
  },
  {
    img: '/img/aeroport-international-de-tunis-carthage-2019.jpg',
    w: 1920,
    h: 1440,
    alt: 'Tunis-Carthage airport terminal under a clear summer sky',
    title: 'Tunis-Carthage',
    text: 'Where a refusal is felt: a wedding missed, a conference skipped, a fee that does not come back.',
  },
  {
    img: '/img/tunisia-ferries-tunis.jpg',
    w: 1920,
    h: 968,
    alt: 'A Tunisia Ferries ship moored in the port of La Goulette, seen from the air',
    title: 'La Goulette',
    text: 'The ferry to Marseille and Genoa, for the dossiers that were complete.',
  },
];

export default function Landing({ lib: libProp, onPickDestination }: Props) {
  const lib = useMemo(() => libProp ?? bundledLibrary(), [libProp]);
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const control = useRef<SceneControl | null>(null);

  // The sample applicant, checked by the real engine (and its corrected version). Timed: speed is part of the story.
  const { docs, fixedDocs, ms } = useMemo(() => {
    const day = today();
    const sample = sampleDossier(day);
    const t0 = performance.now();
    const all = runChecks(sample.dossier, { trip: sample.trip, lib, applicationDate: day, rates: DEFAULT_RATES });
    const ms = Math.max(1, Math.round(performance.now() - t0));
    const fixed = sampleDossier(day, true);
    const fixedFindings = runChecks(fixed.dossier, { trip: fixed.trip, lib, applicationDate: day, rates: DEFAULT_RATES });
    return { docs: buildDossier(sample, all), fixedDocs: buildDossier(fixed, fixedFindings), ms };
  }, [lib]);

  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [found, setFound] = useState<DocId[]>([]);
  const [cursor, setCursor] = useState<CursorMode>('lamp');
  const [fixed, setFixed] = useState<'no' | 'fixing' | 'yes'>('no');
  const [introOn, setIntroOn] = useState(() => {
    try {
      return !sessionStorage.getItem('cv.intro') && !location.search.includes('nointro');
    } catch {
      return true;
    }
  });
  const [country, setCountry] = useState<string | null>(null);
  const total = docs.filter((d) => d.finding).length;

  const stats = useMemo(() => {
    const { years, states } = statsByState(lib.stats);
    const y = years[years.length - 1];
    const all = states.map((s) => ({ name: s.state, rate: s.byYear[y]?.rate ?? 0, applied: s.byYear[y]?.applied ?? 0, notIssued: s.byYear[y]?.notIssued ?? 0 }));
    const rows = all.slice(0, 10);
    const max = Math.max(...rows.map((r) => r.rate));
    const file = lib.stats.find((f) => f.year === y);
    return { year: y, rows, all, max, applied: file?.totals.applied ?? 0, notIssued: file?.totals.notIssued ?? 0 };
  }, [lib]);

  // Real rules, in plain words, for the "rules come down" rain.
  const rain = useMemo(
    () =>
      lib.facts
        .filter((f) => f.statement && f.statement.length < 95 && f.status === 'verified')
        .slice(0, 16)
        .map((f) => ({ id: f.id, text: f.statement, where: f.locator })),
    [lib],
  );


  // ------------------------------------------------------------------------------ motion
  useEffect(() => {
    const root = rootRef.current!;
    root.classList.add('js');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const prevBg = document.body.style.background;
    document.body.style.background = '#0f1f10';

    if (reduce) {
      control.current?.playIntro();
      setIntroOn(false);
      return () => void (document.body.style.background = prevBg);
    }

    const lenis = new Lenis({ lerp: 0.1 });
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const ctx = gsap.context(() => {
      // ---- 1. Intro: a UV beam reads a hidden sentence, then the room light flickers on.
      const heroIn = () => {
        const split = SplitText.create('.lp-hero-copy h1', { type: 'lines,words', mask: 'lines' });
        const tl = gsap.timeline();
        tl.from(split.words, { yPercent: 115, duration: 1.1, stagger: 0.05, ease: 'expo.out' }, 0.9)
          .from('.lp-hero-side > *', { opacity: 0, y: 24, duration: 0.9, stagger: 0.1, ease: 'expo.out' }, 1.3)
          .from('.lp-nav > *', { opacity: 0, y: -14, duration: 0.8, stagger: 0.06, ease: 'expo.out' }, 1.4)
          .from('.lp-tally', { opacity: 0, x: -20, duration: 0.8, ease: 'expo.out' }, 1.8);
      };

      const screen = root.querySelector<HTMLElement>('.lp-introscreen');
      if (screen) {
        lenis.stop();
        const beam = { x: -25, y: 55, r: 18 };
        const paint = () => {
          screen.style.setProperty('--bx', `${beam.x}%`);
          screen.style.setProperty('--by', `${beam.y}%`);
          screen.style.setProperty('--br', `${beam.r}vmax`);
        };
        paint();
        const finish = () => {
          try {
            sessionStorage.setItem('cv.intro', '1');
          } catch {
            /* private mode */
          }
          setIntroOn(false);
          lenis.start();
        };
        const tl = gsap.timeline({ onUpdate: paint });
        tl.to(beam, { x: 50, duration: 1.3, ease: 'power2.inOut' })
          .to(beam, { y: 45, duration: 0.65, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 0)
          .to(beam, { x: 118, duration: 1.0, ease: 'power2.in' })
          .to(beam, { x: 50, y: 50, r: 160, duration: 0.6, ease: 'power3.in' })
          .add(() => {
            control.current?.playIntro();
            heroIn();
          })
          .to(screen, { keyframes: [{ opacity: 0, duration: 0.05 }, { opacity: 0.8, duration: 0.06 }, { opacity: 0, duration: 0.08 }, { opacity: 0.5, duration: 0.05 }, { opacity: 0, duration: 0.2 }] })
          .add(finish);
        // Skipping fast-forwards (seeking would jump over the callbacks that switch the room on).
        const skip = () => tl.timeScale(7);
        screen.addEventListener('pointerdown', skip);
        window.addEventListener('keydown', skip, { once: true });
      } else {
        control.current?.playIntro();
        heroIn();
      }

      // ---- 2. Scrolling away from the hero: pinned, the camera dives and the sheets scatter.
      ScrollTrigger.create({
        trigger: '.lp-hero',
        start: 'top top',
        end: '+=110%',
        pin: true,
        scrub: true,
        onUpdate: (self) => control.current?.setExit(self.progress),
      });
      gsap.to('.lp-hero-copy, .lp-tally', {
        yPercent: -40,
        opacity: 0,
        ease: 'none',
        scrollTrigger: { trigger: '.lp-hero', start: 'top top', end: '+=55%', scrub: true },
      });

      // ---- 3. The number counts with the scroll, the sentence rises line by line.
      const num = root.querySelector<HTMLElement>('[data-count]');
      if (num) {
        const o = { v: 0 };
        gsap.to(o, {
          v: Number(num.dataset.count),
          ease: 'power2.out',
          scrollTrigger: { trigger: '.lp-intro', start: 'top 85%', end: 'center 55%', scrub: 0.6 },
          onUpdate: () => (num.textContent = Math.round(o.v).toLocaleString('en-GB')),
        });
      }

      // ---- 4. Headings: lines slide up out of a mask as they enter.
      gsap.utils.toArray<HTMLElement>('[data-split]').forEach((el) => {
        const s = SplitText.create(el, { type: 'lines', mask: 'lines' });
        gsap.from(s.lines, { yPercent: 105, duration: 1.1, stagger: 0.09, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 86%', once: true } });
      });
      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
        gsap.to(el.children, { opacity: 1, y: 0, duration: 0.95, stagger: 0.08, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 86%', once: true } });
      });

      // ---- 5. The road to Schengen: pinned, sideways.
      const track = root.querySelector<HTMLElement>('.lp-track');
      if (track) {
        const dist = () => track.scrollWidth - window.innerWidth;
        const move = gsap.to(track, {
          x: () => -dist(),
          ease: 'none',
          scrollTrigger: { trigger: '.lp-journey', start: 'top top', end: () => `+=${dist()}`, pin: true, scrub: 0.8, invalidateOnRefresh: true },
        });
        gsap.utils.toArray<HTMLElement>('.lp-panel img').forEach((img) => {
          gsap.fromTo(img, { xPercent: -9 }, { xPercent: 9, ease: 'none', scrollTrigger: { trigger: img, containerAnimation: move, start: 'left right', end: 'right left', scrub: true } });
        });
        gsap.utils.toArray<HTMLElement>('.lp-panel-text').forEach((t) => {
          gsap.from(t.children, { y: 40, opacity: 0, stagger: 0.08, duration: 0.8, ease: 'expo.out', scrollTrigger: { trigger: t, containerAnimation: move, start: 'left 80%' } });
        });
      }

      // ---- 6. Rules come down, documents never go up.
      const rainTl = gsap.timeline({
        scrollTrigger: { trigger: '.lp-rain', start: 'top top', end: '+=170%', pin: true, scrub: 0.6 },
      });
      gsap.utils.toArray<HTMLElement>('.lp-drop').forEach((d, i) => {
        const speed = 0.55 + ((i * 37) % 10) / 18;
        rainTl.fromTo(d, { yPercent: -260 - Math.floor(i / 4) * 230 }, { yPercent: 1000 * speed, ease: 'none', duration: 0.62 }, 0);
      });
      rainTl
        .to('.lp-rain-a', { autoAlpha: 0, y: -60, duration: 0.08 }, 0.5)
        .fromTo('.lp-rain-b', { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, duration: 0.08 }, 0.55)
        .fromTo('.lp-upload', { y: 0, opacity: 0 }, { opacity: 1, duration: 0.04 }, 0.56)
        .to('.lp-upload', { y: () => -window.innerHeight * 0.38, duration: 0.14, ease: 'power2.in' }, 0.62)
        .to('.lp-upload', { y: 0, rotation: -4, duration: 0.07, ease: 'back.out(3)' }, 0.78)
        .to('.lp-upload', { rotation: 3, duration: 0.02, yoyo: true, repeat: 3 }, 0.85)
        .to('.lp-upload', { rotation: 0, duration: 0.02 }, 0.93)
        .fromTo('.lp-upload-tag', { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.05, ease: 'back.out(2)' }, 0.8)
        .to({}, { duration: 0.05 });

      // ---- 7. Bars rise, the footer name grows.
      gsap.from('.lp-bar-fill', { scaleY: 0, duration: 1.3, stagger: 0.06, ease: 'expo.out', scrollTrigger: { trigger: '.lp-bars', start: 'top 82%', once: true } });
      gsap.fromTo('.lp-wordmark', { scale: 0.55 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.lp-foot', start: 'top bottom', end: 'bottom bottom', scrub: true } });

      // ---- 8. Magnetic buttons.
      gsap.utils.toArray<HTMLElement>('.lp-btn, .lp-dest button').forEach((b) => {
        const xTo = gsap.quickTo(b, 'x', { duration: 0.5, ease: 'power3.out' });
        const yTo = gsap.quickTo(b, 'y', { duration: 0.5, ease: 'power3.out' });
        b.addEventListener('pointermove', (e) => {
          const r = b.getBoundingClientRect();
          xTo((e.clientX - r.left - r.width / 2) * 0.3);
          yTo((e.clientY - r.top - r.height / 2) * 0.4);
        });
        b.addEventListener('pointerleave', () => {
          gsap.to(b, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)' });
        });
      });

      // ---- 9. Footer letters lift under the pointer.
      const letters = gsap.utils.toArray<HTMLElement>('.lp-wordmark span');
      const lifts = letters.map((l) => gsap.quickTo(l, 'yPercent', { duration: 0.6, ease: 'power3.out' }));
      const foot = root.querySelector<HTMLElement>('.lp-foot');
      foot?.addEventListener('pointermove', (e) => {
        letters.forEach((l, i) => {
          const r = l.getBoundingClientRect();
          const d = Math.abs(e.clientX - (r.left + r.width / 2));
          lifts[i](-Math.max(0, 1 - d / 260) * 14);
        });
      });
      foot?.addEventListener('pointerleave', () => lifts.forEach((f) => f(0)));
    }, root);

    return () => {
      ctx.revert();
      gsap.ticker.remove(tick);
      lenis.destroy();
      document.body.style.background = prevBg;
    };
  }, []);

  // The lamp's cursor.
  useEffect(() => {
    const hero = heroRef.current!;
    const ring = ringRef.current!;
    const xTo = gsap.quickTo(ring, 'x', { duration: 0.18, ease: 'power3.out' });
    const yTo = gsap.quickTo(ring, 'y', { duration: 0.18, ease: 'power3.out' });
    const move = (e: PointerEvent) => {
      const r = hero.getBoundingClientRect();
      xTo(e.clientX - r.left);
      yTo(e.clientY - r.top);
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
  const noteLeft = hover ? hover.x > (heroRef.current?.clientWidth ?? 0) * 0.62 : false;
  const allFound = found.length >= total && total > 0;
  const pct = Math.round((stats.notIssued / stats.applied) * 100);
  const countryStat = country ? stats.all.find((s) => s.name === country) : undefined;

  return (
    <div className="lp" ref={rootRef}>
      {introOn && (
        <div className="lp-introscreen" aria-hidden="true">
          <p>One missing page is enough to be refused.</p>
          <span className="lp-skip">Click to skip</span>
        </div>
      )}

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
        <div className="lp-nav-end">
          <a href="#/signin" className="lp-signin">
            Sign in
          </a>
          <a href="#/trip" className="lp-btn">
            Open the app
          </a>
        </div>
      </nav>

      <header className={`lp-hero cursor-${cursor}`} ref={heroRef}>
        <UvLampScene
          docs={docs}
          fixedDocs={fixedDocs}
          eventSource={heroRef}
          control={control}
          onHover={setHover}
          onCursor={setCursor}
          onFound={(id) => setFound((f) => (f.includes(id) ? f : [...f, id]))}
          onFixed={() => setFixed('yes')}
        />
        <div className="lp-ring" ref={ringRef} style={{ opacity: 0 }}>
          <span>{cursor === 'grab' ? 'Drag' : ''}</span>
        </div>

        <div className="lp-hero-copy">
          <h1>Check your dossier like the consulate will.</h1>
          <div className="lp-hero-side">
            <p>
              Hold the lamp over this sample dossier, and pick the papers up if you like. The problems it shows are the ones that get applications
              refused in Tunisia, and CheckVisa finds them on your laptop without uploading a page.
            </p>
            <a href="#/trip" className="lp-btn">
              Check my own dossier <Arrow />
            </a>
          </div>
        </div>

        <div className="lp-tally" aria-live="polite">
          {fixed === 'yes' ? (
            <>
              <strong>
                <span>Fixed.</span>
              </strong>
              Passport valid long enough, insurance to the last day, three statements, one name. This dossier now passes every check.
            </>
          ) : (
            <>
              <strong>
                <span>{found.length}</span> of {total}
              </strong>
              {allFound
                ? `All found, in ${ms} ms on this device.`
                : found.length === 0
                  ? 'problems found. Move the lamp over the documents.'
                  : 'problems found. Keep looking.'}
              {allFound && fixed === 'no' && (
                <button
                  type="button"
                  className="lp-fix"
                  onClick={() => {
                    setFixed('fixing');
                    control.current?.fix();
                  }}
                >
                  Fix this dossier <Arrow />
                </button>
              )}
            </>
          )}
        </div>

        {hover && hf && (
          <div key={hover.id} className={`lp-note${noteLeft ? ' left' : ''}`} style={{ left: hover.x, top: hover.y }} role="status">
            <b>{hf.title}</b>
            <p>{hf.detail}</p>
            {hfFact && (
              <small>
                {hfFact.locator.startsWith('Art') ? 'EU Visa Code, ' : ''}
                {hfFact.locator}
              </small>
            )}
          </div>
        )}
      </header>

      <section className="lp-intro" aria-labelledby="intro-title">
        <h2 id="intro-title" className="lp-num" data-count={stats.notIssued}>
          {stats.notIssued.toLocaleString('en-GB')}
        </h2>
        <div className="lp-intro-text">
          <p className="lp-statement" data-split>
            Schengen visa applications lodged in Tunisia were not issued in {stats.year}.
          </p>
          <div data-reveal>
            <p>
              That is about one in {Math.round(100 / pct)} of the {stats.applied.toLocaleString('en-GB')} people who queued, paid the non-refundable
              €90 fee and waited. Many were missing a single page.
            </p>
          </div>
        </div>
      </section>

      <section className="lp-journey" aria-label="The road to a Schengen visa">
        <div className="lp-track">
          <div className="lp-panel lp-panel-lead">
            <h2 data-split>The road starts in Tunis.</h2>
          </div>
          {JOURNEY.map((j) => (
            <figure className="lp-panel" key={j.title}>
              <div className="lp-panel-img">
                <img src={j.img} width={j.w} height={j.h} alt={j.alt} loading="lazy" decoding="async" />
              </div>
              <figcaption className="lp-panel-text">
                <b>{j.title}</b>
                <span>{j.text}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="lp-rain" id="how" aria-label="How CheckVisa works">
        <div className="lp-drops" aria-hidden="true">
          {rain.map((r, i) => (
            <div key={r.id} className="lp-drop" style={{ left: `${40 + (i % 4) * 14.5}%` }}>
              {r.text}
              <small>{r.where}</small>
            </div>
          ))}
        </div>
        <div className="lp-rain-copy lp-rain-a">
          <h2>Rules come down.</h2>
          <p>
            The cloud does one job: it compiles public rules. The EU Visa Code, the EU list of documents for Tunisia, each consulate's checklist, the
            central bank's exchange rates. Every rule keeps its source and its exact words.
          </p>
        </div>
        <div className="lp-rain-copy lp-rain-b">
          <h2>Documents never go up.</h2>
          <p>
            Your passport, payslips and bank statements are read by Gemini Nano inside Chrome, on this laptop. A ledger lists every AI call, and
            checking the sample dossier makes none to the cloud.
          </p>
        </div>
        <div className="lp-upload" aria-hidden="true">
          <b>passport.pdf</b>
          <span>Yasmine Ben Salah · 1 page</span>
          <em className="lp-upload-tag">Stays on this laptop</em>
        </div>
      </section>

      <section className="lp-rules" aria-label="Your choice">
        <div className="lp-rule" data-reveal>
          <h2>You decide the rest.</h2>
          <p>
            No Gemini Nano on your machine? Type the fields yourself, or tick a box to let the cloud read one document. Nothing leaves before you tick
            it.
          </p>
        </div>
      </section>

      <PassportTimeline lib={lib} day={today()} />

      <section className="lp-proof" aria-labelledby="proof-title">
        <h2 id="proof-title" data-split>
          Where the rules come from
        </h2>
        <div data-reveal>
          <p>
            EU law from the <b>EU Publications Office</b>, statistics from the <b>European Commission</b>, checklists from <b>France</b>, <b>Italy</b>,{' '}
            <b>Germany</b>, <b>Spain</b>, <b>Belgium</b>, <b>the Netherlands</b> and <b>Switzerland</b>, rates from the <b>Banque Centrale de Tunisie</b>.
          </p>
        </div>
      </section>

      <section className="lp-stats" id="numbers" aria-labelledby="stats-title">
        <div className="lp-stats-head">
          <h2 id="stats-title" data-split>
            Refusals differ by consulate.
          </h2>
          <div data-reveal>
            <p>
              Share of short-stay applications not issued by each country's consulates in Tunisia, {stats.year}, for the ten busiest. Point at a bar for
              the counts. Source: European Commission visa statistics.
            </p>
          </div>
        </div>
        <div className="lp-bars" role="list">
          {stats.rows.map((r) => (
            <div key={r.name} className={`lp-bar${r.rate === stats.max ? ' is-max' : ''}`} role="listitem" tabIndex={0}>
              <div className="lp-bar-fill" style={{ height: `${(r.rate / stats.max) * 100}%` }}>
                <span>{Math.round(r.rate * 100)}%</span>
                <span className="lp-bar-more">
                  {r.notIssued.toLocaleString('en-GB')} of {r.applied.toLocaleString('en-GB')}
                </span>
              </div>
              <div className="lp-bar-name">{r.name}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-faq" id="questions" aria-labelledby="faq-title">
        <h2 id="faq-title" data-split>
          Questions
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

      <section className="lp-cta" aria-labelledby="cta-title" onPointerLeave={() => setCountry(null)}>
        <span className="lp-cta-rate" aria-hidden="true">
          {countryStat ? `${Math.round(countryStat.rate * 100)}%` : ''}
        </span>
        <h2 id="cta-title" data-split>
          Where are you going?
        </h2>
        <p className="lp-cta-sub" aria-live="polite">
          {countryStat
            ? `${countryStat.notIssued.toLocaleString('en-GB')} of ${countryStat.applied.toLocaleString('en-GB')} applications to ${countryStat.name} were not issued in ${stats.year}. Click to open its checklist.`
            : 'Pick the country of your main stay. Your checklist opens with its rules.'}
        </p>
        <div className="lp-dest">
          {(Object.entries(DESTINATIONS) as Array<[Destination, string]>).map(([code, name]) => (
            <button key={code} type="button" onClick={() => onPickDestination(code)} onPointerEnter={() => setCountry(name)} onFocus={() => setCountry(name)}>
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
              <a href="https://commons.wikimedia.org/wiki/File:Bab_Bhar_photo_2_%D8%A8%D8%A7%D8%A8_%D8%A7%D9%84%D8%A8%D8%AD%D8%B1.jpg">Bab Bhar</a> by Sami
              Mlouhi, <a href="https://creativecommons.org/licenses/by-sa/4.0">CC BY-SA 4.0</a>. All via Wikimedia Commons. The dossier is a specimen drawn
              in code.
            </p>
          </div>
        </div>
        <p className="lp-wordmark" aria-label="CheckVisa">
          {'CheckVisa'.split('').map((c, i) => (
            <span key={i} aria-hidden="true">
              {c}
            </span>
          ))}
        </p>
      </footer>
    </div>
  );
}
