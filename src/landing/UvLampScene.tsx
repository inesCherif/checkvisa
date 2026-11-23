// The hero scene: four specimen documents on a dark desk, and a UV lamp that follows the pointer.
// Under the lamp, the printed paper darkens and the hidden fluorescent layer glows, revealing the
// problems CheckVisa's rule engine found. Vanilla three.js, one draw call per sheet.

import { useEffect, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import type { DocId, DocTexture } from './dossierTextures';

export interface HoverInfo {
  id: DocId;
  x: number; // screen px, relative to the hero
  y: number;
}

interface Props {
  docs: DocTexture[];
  /** Element that receives pointer events (the whole hero). */
  eventSource: RefObject<HTMLElement | null>;
  onHover: (h: HoverInfo | null) => void;
  onFound: (id: DocId) => void;
  onReady?: () => void;
}

const vertex = /* glsl */ `
  uniform float uCurl;
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec3 p = position;
    // Paper is never perfectly flat: a soft lift at the corners.
    p.z += uCurl * (pow(abs(uv.x - 0.5) * 2.0, 2.0) + pow(abs(uv.y - 0.5) * 2.0, 3.0)) * 0.5;
    vec4 w = modelMatrix * vec4(p, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D tVis;
  uniform sampler2D tUv;
  uniform vec3 uLamp;
  uniform float uRadius;
  uniform float uTime;
  uniform float uFound;
  uniform float uPower;
  uniform vec4 uHot;
  varying vec2 vUv;
  varying vec3 vWorld;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    vec2 uv = vUv;
    vec3 vis = texture2D(tVis, uv).rgb;
    vec3 glow = texture2D(tUv, uv).rgb;

    // Room light: one weak lamp up and to the left, falling off across the desk.
    float key = 1.0 - smoothstep(0.0, 7.5, distance(vWorld.xy, vec2(-1.5, 2.2)));
    float room = 0.30 + 0.38 * key;

    // UV beam: soft disc with a faint flicker, like a cheap inspection torch.
    float d = distance(vWorld.xy, uLamp.xy);
    float flicker = 0.94 + 0.06 * sin(uTime * 31.0) * sin(uTime * 7.0);
    float beam = (1.0 - smoothstep(uRadius * 0.55, uRadius, d)) * uPower * flicker;

    vec3 col = vis * room * (1.0 - 0.9 * beam);           // printed paper sinks into the dark
    col += vec3(0.035, 0.07, 0.075) * beam * dot(vis, vec3(0.33)); // the cold cast of UV on paper
    col += glow * beam * 2.4;                               // what fluoresces
    float rim = smoothstep(0.035, 0.0, abs(d - uRadius * 0.9)) * uPower;
    col += vec3(0.78, 0.95, 0.62) * rim * 0.12;

    // A found problem keeps a faint glow afterwards, so you can see what you uncovered.
    vec2 q = (uv - vec2(uHot.x, 1.0 - uHot.y - uHot.w)) / uHot.zw;
    float inHot = step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0);
    col += glow * inHot * uFound * 0.55 * (1.0 - beam);

    // Grain so the sheets read as paper, not screens.
    col += (hash(uv * 900.0 + uTime) - 0.5) * 0.025;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const deskFragment = /* glsl */ `
  uniform vec3 uLamp;
  uniform float uRadius;
  uniform float uPower;
  varying vec3 vWorld;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vec3 ground = vec3(0.059, 0.122, 0.063);                // #0F1F10
    float key = 1.0 - smoothstep(0.0, 8.0, distance(vWorld.xy, vec2(-1.5, 2.2)));
    vec3 col = ground * (0.7 + 0.5 * key);
    float d = distance(vWorld.xy, uLamp.xy);
    col += vec3(0.78, 0.95, 0.62) * (1.0 - smoothstep(0.0, uRadius * 1.25, d)) * 0.07 * uPower;
    col += (hash(vWorld.xy * 300.0) - 0.5) * 0.018;
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

/** Where each sheet lies on the desk (world units), for wide and narrow screens. */
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
  g.fillStyle = 'rgba(0,0,0,0)';
  g.fillRect(0, 0, 128, 128);
  g.shadowColor = 'rgba(0,0,0,0.85)';
  g.shadowBlur = 22;
  g.fillStyle = 'rgba(0,0,0,0.85)';
  g.fillRect(24, 24, 80, 80);
  return new THREE.CanvasTexture(c);
}

export default function UvLampScene({ docs, eventSource, onHover, onFound, onReady }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const cb = useRef({ onHover, onFound, onReady });
  cb.current = { onHover, onFound, onReady };

  useEffect(() => {
    const mount = mountRef.current!;
    const source = eventSource.current ?? mount;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch {
      return; // No WebGL: the static notes beside the hero still tell the story.
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setClearColor('#0f1f10');
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden', 'true');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    const lamp = new THREE.Vector3(1.6, 0.2, 0);
    const lampTarget = lamp.clone();
    const shared = { uLamp: { value: lamp }, uRadius: { value: 0.72 }, uPower: { value: 0 }, uTime: { value: 0 } };

    const desk = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 30),
      new THREE.ShaderMaterial({ vertexShader: deskVertex, fragmentShader: deskFragment, uniforms: shared }),
    );
    scene.add(desk);

    const shadowTex = shadowTexture();
    const sheets = docs.map((doc, i) => {
      const L = LAYOUT[doc.id];
      const w = L.h * doc.aspect;
      const tVis = new THREE.CanvasTexture(doc.visible);
      const tUv = new THREE.CanvasTexture(doc.uv);
      tVis.colorSpace = THREE.SRGBColorSpace;
      tUv.colorSpace = THREE.SRGBColorSpace;
      tVis.anisotropy = tUv.anisotropy = 8;
      const mat = new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          ...shared,
          tVis: { value: tVis },
          tUv: { value: tUv },
          uFound: { value: 0 },
          uCurl: { value: 0.035 + i * 0.01 },
          uHot: { value: new THREE.Vector4(doc.hotspot.x, doc.hotspot.y, doc.hotspot.w, doc.hotspot.h) },
        },
      });
      const group = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, L.h, 24, 24), mat);
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 1.6, L.h * 1.6),
        new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.75, depthWrite: false }),
      );
      shadow.position.set(0.06, -0.08, -0.005);
      group.add(shadow, mesh);
      scene.add(group);
      const hot = new THREE.Vector3((doc.hotspot.x + doc.hotspot.w / 2 - 0.5) * w, (0.5 - doc.hotspot.y - doc.hotspot.h / 2) * L.h, 0);
      return { doc, group, mesh, mat, w, h: L.h, hot, found: false, lift: 0 };
    });

    let narrow = false;
    function layout() {
      const { clientWidth: W, clientHeight: H } = mount;
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      narrow = W / H < 1.05;
      if (narrow) {
        // Portrait screens: fit the dossier width, keep it in the upper part above the headline.
        const visH = Math.max(4.6 / camera.aspect, 6.2);
        const z = visH / (2 * Math.tan(THREE.MathUtils.degToRad(14)));
        const lookY = 0.85 - 0.14 * visH;
        camera.position.set(0, lookY - z * 0.26, z);
        camera.lookAt(0, lookY, 0);
      } else {
        camera.position.set(1.2, -3.1, 11);
        camera.lookAt(1.2, -0.55, 0);
      }
      camera.updateProjectionMatrix();
      for (const s of sheets) {
        const [x, y, z, r] = LAYOUT[s.doc.id][narrow ? 'narrow' : 'wide'];
        s.group.userData.home = { x, y, z, r };
        if (!s.group.userData.placed) continue;
        s.group.position.set(x, y, z);
        s.group.rotation.z = r;
      }
    }
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(mount);

    // Sheets fall onto the desk one after another.
    sheets.forEach((s, i) => {
      const { x, y, z, r } = s.group.userData.home;
      s.group.userData.placed = true;
      if (reduce) {
        s.group.position.set(x, y, z);
        s.group.rotation.z = r;
        return;
      }
      s.group.position.set(x + 0.4, y - 5, z + 2);
      s.group.rotation.set(-0.6, 0, r + 0.5);
      gsap.to(s.group.position, { x, y, z, duration: 1.4, delay: 0.25 + i * 0.14, ease: 'expo.out' });
      gsap.to(s.group.rotation, { x: 0, z: r, duration: 1.6, delay: 0.25 + i * 0.14, ease: 'expo.out' });
    });
    gsap.to(shared.uPower, { value: 1, duration: 1.2, delay: reduce ? 0 : 1.1, ease: 'power2.out' });

    // Pointer → point on the desk.
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    let userDriven = false;
    let lastMove = 0;
    const tilt = new THREE.Vector2();
    function onMove(e: PointerEvent) {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      tilt.copy(ndc);
      ray.setFromCamera(ndc, camera);
      const hit = new THREE.Vector3();
      if (ray.ray.intersectPlane(plane, hit)) {
        lampTarget.copy(hit);
        userDriven = true;
        lastMove = performance.now();
      }
    }
    source.addEventListener('pointermove', onMove);
    source.addEventListener('pointerdown', onMove);

    // Only render while the hero is on screen and the tab is visible: the GPU is also Gemini Nano's.
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
    let readyFired = false;

    function frame() {
      const t = clock.getElapsedTime();
      shared.uTime.value = t;
      // Before the visitor moves, the lamp drifts slowly across the desk to show what it does.
      const idle = !userDriven || performance.now() - lastMove > 5000;
      if (idle) {
        const cx = narrow ? 0 : 1.6;
        lampTarget.set(cx + Math.sin(t * 0.37) * (narrow ? 1.1 : 1.7), (narrow ? 0.6 : 0.1) + Math.sin(t * 0.53 + 1) * 0.9, 0);
      }
      lamp.lerp(lampTarget, reduce ? 1 : idle ? 0.03 : 0.16);

      let nowHover: DocId | null = null;
      for (const s of sheets) {
        // The sheet under the lamp lifts a little and leans toward the pointer.
        tmp.copy(lamp);
        s.mesh.worldToLocal(tmp);
        const under = Math.abs(tmp.x) < s.w / 2 && Math.abs(tmp.y) < s.h / 2;
        s.lift += ((under ? 0.06 : 0) - s.lift) * 0.08;
        s.mesh.position.z = s.lift;
        if (!reduce) {
          s.mesh.rotation.x += (-tilt.y * 0.05 - s.mesh.rotation.x) * 0.05;
          s.mesh.rotation.y += (tilt.x * 0.06 - s.mesh.rotation.y) * 0.05;
        }
        // Is the beam on this sheet's problem?
        const d = Math.hypot(tmp.x - s.hot.x, tmp.y - s.hot.y);
        if (!idle && d < shared.uRadius.value * 0.62) {
          nowHover = s.doc.id;
          if (!s.found) {
            s.found = true;
            gsap.to(s.mat.uniforms.uFound, { value: 1, duration: 0.6 });
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

      renderer.render(scene, camera);
      if (!readyFired) {
        readyFired = true;
        cb.current.onReady?.();
      }
    }

    function toggle() {
      renderer.setAnimationLoop(visible && !document.hidden ? frame : null);
    }
    toggle();

    return () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      source.removeEventListener('pointermove', onMove);
      source.removeEventListener('pointerdown', onMove);
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
  }, [docs, eventSource]);

  return <div ref={mountRef} className="lamp-canvas" />;
}
