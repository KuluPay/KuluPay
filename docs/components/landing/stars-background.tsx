'use client';

import { useEffect, useRef } from 'react';

const settings = { size: 0.75, speed: 1, brightness: 0.25 };

export function StarsBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef(settings);

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

  return (
    <div
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-background" />
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
