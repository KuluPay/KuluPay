'use client';

import { useEffect, useRef, useState } from 'react';

type StarSettings = {
  size: number;
  speed: number;
  brightness: number;
};

const STORAGE_KEY = 'kulu-stars-settings';

const clampStep = (v: number, step: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.round((v + step) * 100) / 100));

export function StarsBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [settings, setSettings] = useState<StarSettings>(() => {
    if (typeof window === 'undefined') return { size: 1, speed: 1, brightness: 1 };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') {
        return {
          size: Number.isFinite(parsed.size) && parsed.size > 0 ? parsed.size : 1,
          speed: Number.isFinite(parsed.speed) && parsed.speed > 0 ? parsed.speed : 1,
          brightness: Number.isFinite(parsed.brightness) && parsed.brightness > 0 ? parsed.brightness : 1,
        };
      }
    } catch {}
    return { size: 1, speed: 1, brightness: 1 };
  });
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const update = (key: keyof StarSettings, step: number, min: number, max: number) => {
    setSettings((s) => ({ ...s, [key]: clampStep(s[key] + step, step, min, max) }));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const gridSize = 32;

    const isDark = () => document.documentElement.classList.contains('dark');

    const getColor = (alpha: number) =>
      isDark() ? `rgba(255, 255, 255, ${alpha})` : `rgba(0, 0, 0, ${alpha})`;

    const draw = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      ctx.clearRect(0, 0, w, h);

      const cols = Math.ceil(w / gridSize) + 1;
      const rows = Math.ceil(h / gridSize) + 1;
      const { size, speed, brightness } = settingsRef.current;

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * gridSize;
          const y = j * gridSize;

          const dx = x - w * 0.5;
          const dy = y - h * 0.4;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = Math.sqrt(w * w + h * h) * 0.7;

          const wave = Math.sin(dist * 0.012 - time * 1.2) * 0.5 + 0.5;
          const falloff = 1 - Math.min(dist / maxDist, 1);
          const opacity = wave * falloff * 0.75 * brightness;

          const dotSize = (1.5 + wave * falloff * 2) * size;

          ctx.beginPath();
          ctx.arc(x, y, dotSize, 0, Math.PI * 2);
          ctx.fillStyle = getColor(opacity);
          ctx.fill();

          // Glow ring for brighter stars
          if (wave * falloff > 0.12) {
            ctx.beginPath();
            ctx.arc(x, y, dotSize * 4, 0, Math.PI * 2);
            ctx.fillStyle = getColor(opacity * 0.22);
            ctx.fill();
          }
        }
      }

      time += 0.008 * speed;
      animationId = requestAnimationFrame(draw);
    };

    draw();

    const observer = new MutationObserver(draw);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
      observer.disconnect();
    };
  }, []);

  const Control = ({
    label,
    keyName,
    value,
    min,
    max,
  }: {
    label: string;
    keyName: keyof StarSettings;
    value: number;
    min: number;
    max: number;
  }) => (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-foreground/50 w-14">{label}</span>
      <button
        type="button"
        onClick={() => update(keyName, -0.25, min, max)}
        className="w-6 h-6 flex items-center justify-center text-xs font-bold rounded-full bg-foreground/[0.05] hover:bg-foreground/15 active:scale-90 transition-all"
        aria-label={`Decrease ${label}`}
      >
        −
      </button>
      <span className="min-w-[3.5rem] px-2 py-1 text-[11px] font-semibold text-foreground/90 text-center tabular-nums font-mono rounded-md bg-foreground/[0.08]">
        {value.toFixed(2)}x
      </span>
      <button
        type="button"
        onClick={() => update(keyName, 0.25, min, max)}
        className="w-6 h-6 flex items-center justify-center text-xs font-bold rounded-full bg-foreground/[0.05] hover:bg-foreground/15 active:scale-90 transition-all"
        aria-label={`Increase ${label}`}
      >
        +
      </button>
    </div>
  );

  return (
    <>
      <div
        className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-background" />
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>

      <div
        className="pointer-events-auto"
        style={{ position: 'fixed', bottom: '0.5rem', right: '1rem', zIndex: 60 }}
      >
        <div className="flex flex-col gap-1.5 px-3 py-2 rounded-2xl border border-foreground/[0.08] bg-background/80 backdrop-blur-md shadow-sm">
          <Control label="Size" keyName="size" value={settings.size} min={0.25} max={3} />
          <Control label="Speed" keyName="speed" value={settings.speed} min={0} max={3} />
          <Control label="Bright" keyName="brightness" value={settings.brightness} min={0.25} max={2} />
        </div>
      </div>
    </>
  );
}
