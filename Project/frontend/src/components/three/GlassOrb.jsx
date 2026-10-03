import { useRef } from "react";

// A large translucent glass orb used on the login visual. CSS-only.
export default function GlassOrb({
  size = 300,
  top = "50%",
  left = "50%",
  color = "rgba(20, 184, 166, 0.10)",
}) {
  const ref = useRef(null);

  return (
    <div
      ref={ref}
      className="glass-orb"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        top,
        left,
        transform: "translate(-50%, -50%)",
        background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.16), ${color} 45%, transparent 72%)`,
      }}
    />
  );
}
