import { useEffect, useRef } from "react";

// Floating translucent shapes used as ambient background dressing.
// Pure CSS transforms for performance; disabled for reduced-motion users.
export default function FloatingShapes({ count = 5 }) {
  const ref = useRef(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const container = ref.current;
    if (!container) return;
    const shapes = container.querySelectorAll("[data-shape]");
    const anims = [];
    shapes.forEach((shape) => {
      const dur = 9 + Math.random() * 8;
      const delay = Math.random() * 4;
      anims.push({
        shape,
        dur,
        anim: shape.animate(
          [
            { transform: "translateY(0) translateX(0)", opacity: 0.35 },
            { transform: `translateY(${-24 + Math.random() * 40}px) translateX(${-16 + Math.random() * 32}px)`, opacity: 0.7 },
            { transform: "translateY(0) translateX(0)", opacity: 0.35 },
          ],
          { duration: dur * 1000, delay: delay * 1000, iterations: Infinity, easing: "ease-in-out" }
        ),
      });
    });
    return () => anims.forEach((a) => a.anim.cancel());
  }, [count]);

  return (
    <div ref={ref} aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          data-shape
          style={{
            position: "absolute",
            width: 40 + (i % 4) * 26,
            height: 40 + (i % 4) * 26,
            borderRadius: i % 3 === 0 ? "50%" : 18,
            border: "1px solid var(--border-strong)",
            background: `radial-gradient(circle at 30% 30%, rgba(20,184,166,${0.05 + (i % 3) * 0.04}), transparent 70%)`,
            top: `${(i * 23) % 90}%`,
            left: `${(i * 37) % 92}%`,
            transform: `rotate(${i * 24}deg)`,
          }}
        />
      ))}
    </div>
  );
}
