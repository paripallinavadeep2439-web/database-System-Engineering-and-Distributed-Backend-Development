import { useEffect, useRef } from "react";

// Subtle animated particle field rendered on a lightweight canvas.
// Optimized: capped particle count and disabled on reduced-motion.
export default function ParticleBackground({ density = 40 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = canvas.getContext("2d");
    let raf = 0;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const count = reduced ? 0 : Math.min(density, 60);
    const particles = Array.from({ length: count }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 1 + Math.random() * 2,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      a: 0.1 + Math.random() * 0.4,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(20, 184, 166, ${p.a})`;
        ctx.fill();
      });
      if (!reduced) raf = requestAnimationFrame(draw);
    };

    const onResize = () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener("resize", onResize);

    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [density]);

  return <canvas ref={ref} aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
}
