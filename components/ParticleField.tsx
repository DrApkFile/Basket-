"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  green: boolean;
}

const COUNT = 60;
const CYCLE_MS = 16_000;
// [start, end] of the convergence envelope within one cycle, in ms.
const RAMP_IN: [number, number] = [6000, 9000];
const HOLD: [number, number] = [9000, 12000];
const RAMP_OUT: [number, number] = [12000, 15000];

function smoothstep(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/** Convergence amount (0..1) at a point in the cycle — most of the cycle sits
 * at 0 (calm ambient drift); the product's whole pitch is reduced variance,
 * so the motion itself should feel smoothed rather than chaotic. */
function convergenceAt(msIntoCycle: number): number {
  if (msIntoCycle < RAMP_IN[0]) return 0;
  if (msIntoCycle < RAMP_IN[1]) {
    return smoothstep((msIntoCycle - RAMP_IN[0]) / (RAMP_IN[1] - RAMP_IN[0]));
  }
  if (msIntoCycle < HOLD[1]) return 1;
  if (msIntoCycle < RAMP_OUT[1]) {
    return 1 - smoothstep((msIntoCycle - HOLD[1]) / (RAMP_OUT[1] - HOLD[1]));
  }
  return 0;
}

/** Fibonacci sphere: N evenly-distributed unit-sphere points. */
function spherePoint(i: number, n: number): [number, number, number] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (i / (n - 1)) * 2;
  const radiusAtY = Math.sqrt(1 - y * y);
  const theta = golden * i;
  return [Math.cos(theta) * radiusAtY, y, Math.sin(theta) * radiusAtY];
}

export default function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) return;
    const maybeCtx = canvas.getContext("2d");
    if (!maybeCtx) return;
    // Rebind to a fresh const: TS fixes a const's type at ITS OWN declaration,
    // so this one stays non-null inside the nested resize/frame closures below
    // (the narrowing on `maybeCtx` itself would not persist into them).
    const ctx = maybeCtx;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const particles: Particle[] = Array.from({ length: COUNT }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.012,
      vy: (Math.random() - 0.5) * 0.012,
      size: 1 + Math.random() * 1.8,
      green: Math.random() < 0.3,
    }));

    function resize() {
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let raf = 0;
    let start = performance.now();

    function frame(now: number) {
      const elapsed = now - start;
      const msIntoCycle = elapsed % CYCLE_MS;
      const conv = reduceMotion ? 0.55 : convergenceAt(msIntoCycle);
      const rotation = (elapsed / 20_000) * Math.PI * 2;
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.16;

      ctx.clearRect(0, 0, width, height);

      const rendered: { x: number; y: number; alpha: number }[] = [];

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (!p) continue;

        // Ambient drift, always running — wraps at the edges.
        p.x += p.vx * (reduceMotion ? 0 : 1);
        p.y += p.vy * (reduceMotion ? 0 : 1);
        if (p.x < -0.05) p.x = 1.05;
        if (p.x > 1.05) p.x = -0.05;
        if (p.y < -0.05) p.y = 1.05;
        if (p.y > 1.05) p.y = -0.05;

        const driftX = p.x * width;
        const driftY = p.y * height;

        const [sx3, sy3, sz3] = spherePoint(i, particles.length);
        const cosR = Math.cos(rotation);
        const sinR = Math.sin(rotation);
        const rx = sx3 * cosR - sz3 * sinR;
        const rz = sx3 * sinR + sz3 * cosR;
        const depth = (rz + 1.4) / 2.4; // 0..1, used for a faint size/alpha cue
        const sphereX = cx + rx * radius;
        const sphereY = cy + sy3 * radius * 0.92;

        const rx2 = driftX + (sphereX - driftX) * conv;
        const ry2 = driftY + (sphereY - driftY) * conv;
        rendered.push({ x: rx2, y: ry2, alpha: 0.35 + depth * 0.35 });

        const size = p.size * (0.8 + depth * 0.5);
        const color = p.green ? "0, 226, 138" : "255, 255, 255";
        const alpha = (0.25 + depth * 0.35) * (0.7 + conv * 0.3);

        ctx.beginPath();
        ctx.fillStyle = `rgba(${color}, ${alpha})`;
        ctx.shadowColor = `rgba(${color}, ${conv > 0.2 ? 0.6 : 0.25})`;
        ctx.shadowBlur = 4 + conv * 6;
        ctx.arc(rx2, ry2, size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Faint woven mesh: connect each point to its next two neighbors in the
      // Fibonacci ordering (a cheap approximation of a sphere wireframe) —
      // only worth drawing once the field has actually pulled together.
      if (conv > 0.12) {
        ctx.lineWidth = 0.6;
        for (let i = 0; i < rendered.length; i++) {
          const a = rendered[i];
          if (!a) continue;
          for (const offset of [1, 2]) {
            const b = rendered[i + offset];
            if (!b) continue;
            ctx.strokeStyle = `rgba(0, 226, 138, ${0.08 * conv})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      ctx.shadowBlur = 0;

      if (!reduceMotion) raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    if (reduceMotion) {
      // One settled frame instead of a running loop.
      cancelAnimationFrame(raf);
      frame(start);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}
