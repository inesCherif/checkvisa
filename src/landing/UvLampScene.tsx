// The hero scene: four specimen documents on a dark desk, lit by a UV inspection lamp that follows
// the pointer. You can pick sheets up and move them. When the lamp lands on a problem the rule
// engine found, a REFUSAL RISK stamp slams onto the sheet. "Fix" flips every sheet to its corrected
// version. Scrolling past the hero dives the camera into the dossier. Vanilla three.js + GSAP.

import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import type { DocId, DocTexture } from './dossierTextures';

export interface HoverInfo {
  id: DocId;
  x: number; // px, relative to the event source
  y: number;
}

export interface SceneControl {
  playIntro: () => void;
  fix: () => void;
  setExit: (p: number) => void;
}

export type CursorMode = 'lamp' | 'grab' | 'drag';

interface Props {
  docs: DocTexture[];
  /** The corrected dossier, shown on the back of each sheet. */
  fixedDocs: DocTexture[];
  eventSource: RefObject<HTMLElement | null>;
  control: MutableRefObject<SceneControl | null>;
  onHover: (h: HoverInfo | null) => void;
  onFound: (id: DocId) => void;
  onCursor: (m: CursorMode) => void;
  onFixed: () => void;
}

const vertex = /* glsl */ `
  uniform float uCurl;
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.z += uCurl * (pow(abs(uv.x - 0.5) * 2.0, 2.0) + pow(abs(uv.y - 0.5) * 2.0, 3.0)) * 0.5;
    vec4 w = modelMatrix * vec4(p, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D tVis;
  uniform sampler2D tUv;
  uniform sampler2D tVisB;
  uniform sampler2D tUvB;
  uniform vec3 uLamp;
  uniform float uRadius;
  uniform float uTime;
  uniform float uFound;
  uniform float uPower;
  uniform float uRoom;
  uniform vec4 uHot;
  varying vec2 vUv;
  varying vec3 vWorld;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    bool front = gl_FrontFacing;
    vec2 uv = front ? vUv : vec2(1.0 - vUv.x, vUv.y);
    vec3 vis = front ? texture2D(tVis, uv).rgb : texture2D(tVisB, uv).rgb;
    vec3 glow = front ? texture2D(tUv, uv).rgb : texture2D(tUvB, uv).rgb;

    float key = 1.0 - smoothstep(0.0, 7.5, distance(vWorld.xy, vec2(-1.5, 2.2)));
    float room = (0.30 + 0.38 * key) * uRoom;

    float d = distance(vWorld.xy, uLamp.xy);
    float flicker = 0.94 + 0.06 * sin(uTime * 31.0) * sin(uTime * 7.0);
    float beam = (1.0 - smoothstep(uRadius * 0.55, uRadius, d)) * uPower * flicker;

    vec3 col = vis * room * (1.0 - 0.9 * beam);
    col += vec3(0.035, 0.07, 0.075) * beam * dot(vis, vec3(0.33));
    col += glow * beam * 2.4;
    float rim = smoothstep(0.035, 0.0, abs(d - uRadius * 0.9)) * uPower;
    col += vec3(0.78, 0.95, 0.62) * rim * 0.12;

    vec2 q = (uv - vec2(uHot.x, 1.0 - uHot.y - uHot.w)) / uHot.zw;
    float inHot = step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0);
    if (front) col += glow * inHot * uFound * 0.55 * (1.0 - beam);

    col += (hash(uv * 900.0 + uTime) - 0.5) * 0.025;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const deskVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const deskFragment = /* glsl */ `
  uniform vec3 uLamp;
  uniform float uRadius;
  uniform float uPower;
  uniform float uRoom;
  varying vec3 vWorld;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vec3 ground = vec3(0.059, 0.122, 0.063);
    float key = 1.0 - smoothstep(0.0, 8.0, distance(vWorld.xy, vec2(-1.5, 2.2)));
    vec3 col = ground * (0.7 + 0.5 * key) * min(uRoom, 1.0);
    float d = distance(vWorld.xy, uLamp.xy);
    col += vec3(0.78, 0.95, 0.62) * (1.0 - smoothstep(0.0, uRadius * 1.25, d)) * 0.07 * uPower;
    col += (hash(vWorld.xy * 300.0) - 0.5) * 0.018;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const LAYOUT: Record<DocId, { h: number; wide: [number, number, number, number]; narrow: [number, number, number, number] }> = {
  insurance: { h: 2.55, wide: [0.35, 0.3, 0.0, 0.1], narrow: [-0.8, 1.55, 0.0, 0.1] },
  statements: { h: 2.55, wide: [2.35, 0.5, 0.01, -0.08], narrow: [0.85, 1.7, 0.01, -0.08] },
  passport: { h: 1.32, wide: [1.05, -0.95, 0.03, -0.05], narrow: [-0.45, 0.05, 0.03, -0.05] },
  booking: { h: 0.98, wide: [3.0, -1.05, 0.04, 0.07], narrow: [0.8, -0.75, 0.04, 0.07] },
};

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.shadowColor = 'rgba(0,0,0,0.85)';
  g.shadowBlur = 22;
  g.fillStyle = 'rgba(0,0,0,0.85)';
  g.fillRect(24, 24, 80, 80);
  return new THREE.CanvasTexture(c);
}

/** A rubber stamp, with uneven ink: the text is knocked out in random specks. */
function stampTexture(label: string, color: string) {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 240;
  const g = c.getContext('2d')!;
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = 12;
  g.strokeRect(14, 14, 612, 212);
  g.lineWidth = 4;
  g.strokeRect(34, 34, 572, 172);
  g.font = '800 92px "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '6px';
  g.fillText(label, 320, 124, 540);
  g.globalCompositeOperation = 'destination-out';
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {
    g.globalAlpha = 0.25 + r() * 0.75;
    g.beginPath();
    g.arc(r() * 640, r() * 240, r() * 3.2, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default function UvLampScene({ docs, fixedDocs, eventSource, control, onHover, onFound, onCursor, onFixed }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const cb = useRef({ onHover, onFound, onCursor, onFixed });
  cb.current = { onHover, onFound, onCursor, onFixed };

  useEffect(() => {
    const mount = mountRef.current!;
    const source = eventSource.current ?? mount;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setClearColor('#0f1f10');
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden', 'true');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    const camPos = new THREE.Vector3();
    const camLook = new THREE.Vector3();
    const intro = { dolly: 1, spin: 1 }; // 1 = far away, 0 = resting pose
    const shake = { x: 0, y: 0 };
    let exitP = 0;

    const lamp = new THREE.Vector3(1.6, 0.2, 0);
    const lampTarget = lamp.clone();
    const shared = {
      uLamp: { value: lamp },
      uRadius: { value: 0.72 },
      uPower: { value: 0 },
      uTime: { value: 0 },
      uRoom: { value: 0 },
    };

    const desk = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 40),
      new THREE.ShaderMaterial({ vertexShader: deskVertex, fragmentShader: deskFragment, uniforms: shared }),
    );
    scene.add(desk);

    const shadowTex = shadowTexture();
    const refusedTex = stampTexture('REFUSAL RISK', '#c4301c');
    const checkedTex = stampTexture('CHECKED', '#2f6a2a');
    const tex = (c: HTMLCanvasElement) => {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      return t;
    };

    const sheets = docs.map((doc, i) => {
      const L = LAYOUT[doc.id];
      const w = L.h * doc.aspect;
      const back = fixedDocs.find((d) => d.id === doc.id) ?? doc;
      const mat = new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        side: THREE.DoubleSide,
        uniforms: {
          ...shared,
          tVis: { value: tex(doc.visible) },
          tUv: { value: tex(doc.uv) },
          tVisB: { value: tex(back.visible) },
          tUvB: { value: tex(back.uv) },
          uFound: { value: 0 },
          uCurl: { value: 0.035 + i * 0.01 },
          uHot: { value: new THREE.Vector4(doc.hotspot.x, doc.hotspot.y, doc.hotspot.w, doc.hotspot.h) },
        },
      });
      const group = new THREE.Group(); // position on the desk + rotation in the desk plane
      const flipper = new THREE.Group(); // lift + flip
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, L.h, 24, 24), mat);
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 1.6, L.h * 1.6),
        new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.75, depthWrite: false }),
      );
      shadow.position.set(0.06, -0.08, -0.005);
      flipper.add(mesh);
      group.add(shadow, flipper);
      scene.add(group);

      const hot = new THREE.Vector3((doc.hotspot.x + doc.hotspot.w / 2 - 0.5) * w, (0.5 - doc.hotspot.y - doc.hotspot.h / 2) * L.h, 0);
      // The red stamp sits on the front, near the problem; the green one on the back.
      const sw = Math.min(w * 0.62, 1.25);
      const stampMat = new THREE.MeshBasicMaterial({ map: refusedTex, transparent: true, opacity: 0, depthWrite: false, color: '#c9c9c9' });
      const stamp = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw * 0.375), stampMat);
      stamp.position.set(
        THREE.MathUtils.clamp(hot.x, -w / 2 + sw / 2, w / 2 - sw / 2),
        THREE.MathUtils.clamp(hot.y - 0.28, -L.h / 2 + 0.2, L.h / 2 - 0.2),
        0.012,
      );
      stamp.rotation.z = -0.18 + i * 0.09;
      mesh.add(stamp);
      const okMat = new THREE.MeshBasicMaterial({ map: checkedTex, transparent: true, opacity: 0, depthWrite: false, color: '#d0d0d0' });
      const ok = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw * 0.375), okMat);
      ok.position.set(0, -L.h * 0.18, -0.012);
      ok.rotation.set(0, Math.PI, 0.14 - i * 0.07);
      mesh.add(ok);

      return {
        doc,
        group,
        flipper,
        mesh,
        mat,
        w,
        h: L.h,
        hot,
        found: false,
        lift: 0,
        base: new THREE.Vector3(),
        spread: new THREE.Vector3(),
        stamp,
        stampMat,
        okMat,
        rz: 0,
      };
    });
    type Sheet = (typeof sheets)[number];
    const meshes = sheets.map((s) => s.mesh);

    let narrow = false;
    let placed = false;
    function layout() {
      const { clientWidth: W, clientHeight: H } = mount;
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      narrow = W / H < 1.05;
      if (narrow) {
        const visH = Math.max(4.6 / camera.aspect, 6.2);
        const z = visH / (2 * Math.tan(THREE.MathUtils.degToRad(14)));
        const lookY = 0.85 - 0.14 * visH;
        camPos.set(0, lookY - z * 0.26, z);
        camLook.set(0, lookY, 0);
      } else {
        camPos.set(1.2, -3.1, 11);
        camLook.set(1.2, -0.55, 0);
      }
      camera.updateProjectionMatrix();
      for (const s of sheets) {
        const [x, y, z, r] = LAYOUT[s.doc.id][narrow ? 'narrow' : 'wide'];
        s.group.userData.home = { x, y, z, r };
        // Where the sheet flies to when you scroll away: outward from the middle of the desk.
        s.spread.set(x - (narrow ? 0 : 1.6), y - 0.2, 0).normalize().multiplyScalar(4);
        if (placed) {
          s.base.set(x, y, z);
          s.rz = r;
        }
      }
    }
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(mount);

    // Before the intro: sheets wait above the desk, out of sight, in the dark.
    for (const s of sheets) {
      const { x, y, z, r } = s.group.userData.home;
      s.base.set(x + 0.4, y - 6, z + 3);
      s.rz = r + 0.6;
      s.group.rotation.x = -0.7;
    }

    function kick(amount: number) {
      if (reduce) return;
      gsap.fromTo(shake, { x: (Math.random() - 0.5) * amount * 2, y: amount }, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
    }

    let introPlayed = false;
    function playIntro() {
      if (introPlayed) return;
      introPlayed = true;
      if (reduce) {
        placed = true;
        layout();
        sheets.forEach((s) => (s.group.rotation.x = 0));
        shared.uRoom.value = 1;
        shared.uPower.value = 1;
        intro.dolly = intro.spin = 0;
        return;
      }
      const tl = gsap.timeline();
      // A fluorescent tube struggling to start.
      tl.to(shared.uRoom, {
        keyframes: [
          { value: 0.7, duration: 0.06 },
          { value: 0.05, duration: 0.09 },
          { value: 0.9, duration: 0.05 },
          { value: 0.15, duration: 0.18 },
          { value: 1, duration: 0.08 },
          { value: 0.6, duration: 0.05 },
          { value: 1, duration: 0.3 },
        ],
      });
      tl.to(intro, { dolly: 0, spin: 0, duration: 2.4, ease: 'expo.inOut' }, 0);
      sheets.forEach((s, i) => {
        const { x, y, z, r } = s.group.userData.home;
        const at = 0.55 + i * 0.16;
        tl.to(s.base, { x, y, z, duration: 1.3, ease: 'power4.out' }, at);
        tl.to(s, { rz: r, duration: 1.5, ease: 'expo.out' }, at);
        tl.to(s.group.rotation, { x: 0, duration: 1.2, ease: 'expo.out' }, at);
        tl.add(() => kick(0.04), at + 0.7); // each landing knocks the camera a little
      });
      tl.add(() => {
        placed = true;
      });
      tl.to(shared.uPower, { value: 1, duration: 0.9, ease: 'power2.out' }, 1.9);
    }

    function slamStamp(s: Sheet) {
      if (reduce) {
        s.stampMat.opacity = 0.92;
        return;
      }
      gsap.fromTo(s.stamp.scale, { x: 2.6, y: 2.6 }, { x: 1, y: 1, duration: 0.32, ease: 'power4.in', onComplete: () => kick(0.09) });
      gsap.fromTo(s.stampMat, { opacity: 0 }, { opacity: 0.92, duration: 0.2, ease: 'power2.in' });
    }

    let fixing = false;
    function fix() {
      if (fixing) return;
      fixing = true;
      cb.current.onHover(null);
      const tl = gsap.timeline({ onComplete: () => cb.current.onFixed() });
      tl.to(shared.uPower, { value: 0, duration: 0.4 }, 0);
      tl.to(shared.uRoom, { value: 1.35, duration: 0.8, ease: 'power2.out' }, 0.1);
      sheets.forEach((s, i) => {
        const at = 0.3 + i * 0.22;
        tl.to(s.flipper.position, { z: 0.9, duration: 0.45, ease: 'power2.out' }, at);
        tl.to(s.flipper.rotation, { y: Math.PI, duration: 0.9, ease: 'power3.inOut' }, at);
        tl.to(s.flipper.position, { z: 0, duration: 0.45, ease: 'power3.in' }, at + 0.5);
        tl.add(() => kick(0.03), at + 0.95);
        tl.fromTo(s.okMat, { opacity: 0 }, { opacity: 0.9, duration: 0.15 }, at + 1.1);
        tl.add(() => kick(0.06), at + 1.2);
      });
    }

    control.current = {
      playIntro,
      fix,
      setExit: (p) => {
        exitP = p;
      },
    };

    // ---------------------------------------------------------------- pointer: lamp + dragging
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const hit = new THREE.Vector3();
    let userDriven = false;
    let lastMove = 0;
    const tilt = new THREE.Vector2();
    let drag: { s: Sheet; off: THREE.Vector3; vx: number; vy: number } | null = null;
    let topZ = 0.05;

    function aim(e: PointerEvent) {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
    }
    function sheetUnder(): Sheet | null {
      const hits = ray.intersectObjects(meshes, false);
      return hits.length ? (sheets.find((s) => s.mesh === hits[0].object) ?? null) : null;
    }
    function onMove(e: PointerEvent) {
      aim(e);
      tilt.copy(ndc);
      if (ray.ray.intersectPlane(plane, hit)) {
        lampTarget.copy(hit);
        userDriven = true;
        lastMove = performance.now();
        if (drag) {
          const nx = hit.x - drag.off.x;
          const ny = hit.y - drag.off.y;
          drag.vx = nx - drag.s.base.x;
          drag.vy = ny - drag.s.base.y;
          drag.s.base.x = nx;
          drag.s.base.y = ny;
        }
      }
      if (!drag && placed && !fixing) cb.current.onCursor(sheetUnder() ? 'grab' : 'lamp');
    }
    function onDown(e: PointerEvent) {
      onMove(e);
      if (!placed || fixing || exitP > 0.02 || e.button > 0) return;
      if ((e.target as Element).closest?.('a,button')) return;
      const s = sheetUnder();
      if (!s || !ray.ray.intersectPlane(plane, hit)) return;
      topZ += 0.02;
      s.base.z = topZ;
      drag = { s, off: hit.clone().sub(s.base), vx: 0, vy: 0 };
      gsap.to(s.flipper.position, { z: 0.35, duration: 0.3, ease: 'power3.out' });
      cb.current.onCursor('drag');
    }
    function onUp() {
      if (!drag) return;
      const s = drag.s;
      gsap.to(s.base, { x: s.base.x + drag.vx * 6, y: s.base.y + drag.vy * 6, duration: 0.6, ease: 'power3.out' });
      gsap.to(s.flipper.position, { z: 0, duration: 0.35, ease: 'power3.in', onComplete: () => kick(0.025) });
      drag = null;
      cb.current.onCursor('grab');
    }
    source.addEventListener('pointermove', onMove);
    source.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);

    // ---------------------------------------------------------------- render loop (paused off-screen)
    let visible = true;
    const io = new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      toggle();
    });
    io.observe(mount);
    const onVis = () => toggle();
    document.addEventListener('visibilitychange', onVis);

    const clock = new THREE.Clock();
    const tmp = new THREE.Vector3();
    let hovered: DocId | null = null;

    function frame() {
      const t = clock.getElapsedTime();
      shared.uTime.value = t;

      const idle = !userDriven || performance.now() - lastMove > 5000;
      if (idle) {
        const cx = narrow ? 0 : 1.6;
        lampTarget.set(cx + Math.sin(t * 0.37) * (narrow ? 1.1 : 1.7), (narrow ? 0.6 : 0.1) + Math.sin(t * 0.53 + 1) * 0.9, 0);
      }
      lamp.lerp(lampTarget, reduce ? 1 : idle ? 0.03 : 0.16);

      // Camera = resting pose + intro flight + pointer parallax + scroll dive + knocks.
      const e = exitP * exitP;
      camera.position.set(
        camPos.x - intro.dolly * 2 + tilt.x * 0.25 * (1 - intro.dolly) + shake.x,
        camPos.y - intro.dolly * 7 + tilt.y * 0.18 + shake.y + e * 2.6,
        camPos.z + intro.dolly * 9 - e * (camPos.z - 2.4),
      );
      camera.up.set(Math.sin(intro.spin * 0.5), Math.cos(intro.spin * 0.5), 0);
      camera.lookAt(camLook.x - intro.dolly, camLook.y + e * 0.4, 0);

      let nowHover: DocId | null = null;
      for (const s of sheets) {
        s.group.position.copy(s.base).addScaledVector(s.spread, e);
        s.group.rotation.z = s.rz + e * (s.spread.x > 0 ? -0.5 : 0.5);
        if (drag?.s === s) s.group.rotation.z += THREE.MathUtils.clamp(drag.vx * 2.5, -0.25, 0.25);

        tmp.copy(lamp);
        s.mesh.worldToLocal(tmp);
        const under = Math.abs(tmp.x) < s.w / 2 && Math.abs(tmp.y) < s.h / 2;
        s.lift += ((under ? 0.06 : 0) - s.lift) * 0.08;
        s.mesh.position.z = s.lift;
        if (!reduce) {
          s.mesh.rotation.x += (-tilt.y * 0.05 - s.mesh.rotation.x) * 0.05;
          s.mesh.rotation.y += (tilt.x * 0.06 - s.mesh.rotation.y) * 0.05;
        }

        const d = Math.hypot(tmp.x - s.hot.x, tmp.y - s.hot.y);
        if (!idle && !fixing && placed && exitP < 0.05 && s.doc.finding && d < shared.uRadius.value * 0.62) {
          nowHover = s.doc.id;
          if (!s.found) {
            s.found = true;
            gsap.to(s.mat.uniforms.uFound, { value: 1, duration: 0.6 });
            slamStamp(s);
            cb.current.onFound(s.doc.id);
          }
          const p = s.hot.clone();
          s.mesh.localToWorld(p);
          p.project(camera);
          const r = renderer.domElement.getBoundingClientRect();
          const host = (eventSource.current ?? mount).getBoundingClientRect();
          cb.current.onHover({ id: s.doc.id, x: ((p.x + 1) / 2) * r.width + r.left - host.left, y: ((1 - p.y) / 2) * r.height + r.top - host.top });
        }
      }
      if (nowHover === null && hovered !== null) cb.current.onHover(null);
      hovered = nowHover;

      // Scrolling away dims the room.
      const room = shared.uRoom.value;
      shared.uRoom.value = room * (1 - exitP * 0.85);
      renderer.render(scene, camera);
      shared.uRoom.value = room;
    }

    function toggle() {
      renderer.setAnimationLoop(visible && !document.hidden ? frame : null);
    }
    toggle();

    return () => {
      control.current = null;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      source.removeEventListener('pointermove', onMove);
      source.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      gsap.killTweensOf([shared.uRoom, shared.uPower, intro, shake]);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const m = o.material as THREE.Material & { uniforms?: Record<string, { value: unknown }>; map?: THREE.Texture };
          m.map?.dispose();
          for (const u of Object.values(m.uniforms ?? {})) if (u.value instanceof THREE.Texture) u.value.dispose();
          m.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [docs, fixedDocs, eventSource, control]);

  return <div ref={mountRef} className="lamp-canvas" />;
}
