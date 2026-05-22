import { useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";

const STARS_COUNT = 220;
const DISMISS_DELTA = 280;

interface Star {
  x: number;
  y: number;
  z: number;
  speed: number;
}

const mkStar = (fromCenter = false): Star => ({
  x: fromCenter ? Math.random() * 0.6 - 0.3 : Math.random() * 2 - 1,
  y: fromCenter ? Math.random() * 0.6 - 0.3 : Math.random() * 2 - 1,
  z: fromCenter ? 0.85 + Math.random() * 0.15 : 0.1 + Math.random() * 0.9,
  speed: 0.0015 + Math.random() * 0.003,
});

export const IntroScreen = () => {
  const [phase, setPhase] = useState<"idle" | "pre-close" | "closing" | "hidden">("idle");
  const [wheelProgress, setWheelProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const starsRef = useRef<Star[]>([]);
  const phaseRef = useRef<"idle" | "pre-close" | "closing" | "hidden">("idle");
  const accRef = useRef(0);
  const startTimeRef = useRef(Date.now());

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Init stars
  useEffect(() => {
    starsRef.current = Array.from({ length: STARS_COUNT }, () => mkStar(false));
  }, []);

  // Canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const loop = () => {
      if (phaseRef.current === "hidden") return;

      const W = canvas.width;
      const H = canvas.height;
      const CX = W / 2;
      const CY = H / 2;

      ctx.clearRect(0, 0, W, H);

      const isWarp = phaseRef.current === "closing" || phaseRef.current === "pre-close";
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const autoBoost = 1 + Math.min(elapsed * 0.05, 0.8);
      const speedMult = isWarp ? 18 : autoBoost;

      for (const star of starsRef.current) {
        const prevSX = (star.x / star.z) * CX + CX;
        const prevSY = (star.y / star.z) * CY + CY;

        star.z -= star.speed * speedMult;

        if (star.z <= 0.01) {
          const ns = mkStar(true);
          star.x = ns.x; star.y = ns.y; star.z = ns.z; star.speed = ns.speed;
          continue;
        }

        const sx = (star.x / star.z) * CX + CX;
        const sy = (star.y / star.z) * CY + CY;

        if (sx < -80 || sx > W + 80 || sy < -80 || sy > H + 80) {
          const ns = mkStar(true);
          star.x = ns.x; star.y = ns.y; star.z = ns.z; star.speed = ns.speed;
          continue;
        }

        const depth = 1 - star.z;
        const brightness = Math.min(1, depth * 1.8);
        const radius = Math.max(0.3, depth * 2.4);

        if (isWarp) {
          ctx.beginPath();
          ctx.moveTo(prevSX, prevSY);
          ctx.lineTo(sx, sy);
          ctx.strokeStyle = `rgba(200, 220, 255, ${brightness * 0.9})`;
          ctx.lineWidth = Math.max(0.4, radius * 0.7);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(sx, sy, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(200, 220, 255, ${brightness})`;
          ctx.fill();
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Lock body scroll while intro is visible
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Wheel + touch input (only when idle)
  useEffect(() => {
    if (phase !== "idle") return;

    const dismiss = () => {
      phaseRef.current = "pre-close";
      setPhase("pre-close");
      setTimeout(() => {
        phaseRef.current = "closing";
        setPhase("closing");
      }, 160);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      accRef.current = Math.max(0, accRef.current + e.deltaY);
      const progress = Math.min(accRef.current / DISMISS_DELTA, 1);
      setWheelProgress(progress);
      if (accRef.current >= DISMISS_DELTA) dismiss();
    };

    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => { touchY = e.touches[0].clientY; };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const delta = touchY - e.touches[0].clientY;
      touchY = e.touches[0].clientY;
      accRef.current = Math.max(0, accRef.current + delta * 2);
      const progress = Math.min(accRef.current / DISMISS_DELTA, 1);
      setWheelProgress(progress);
      if (accRef.current >= DISMISS_DELTA) dismiss();
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [phase]);

  // Hide after closing animation
  useEffect(() => {
    if (phase !== "closing") return;
    const t = setTimeout(() => {
      document.body.style.overflow = "";
      window.dispatchEvent(new CustomEvent("intro:done"));
      setPhase("hidden");
      setTimeout(() => window.scrollTo(0, 0), 10);
    }, 780);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "hidden") return null;

  const isPunching = phase === "pre-close";
  const isClosing = phase === "closing";

  const textOpacity = Math.max(1 - wheelProgress * 2.5, 0);
  const textTranslateY = -(wheelProgress * 70);
  const indicatorOpacity = Math.max(1 - wheelProgress * 5, 0);

  return (
    <>
      <style>{`
        @keyframes intro-in {
          from { opacity: 0; transform: translateY(36px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .intro-line {
          animation: intro-in 0.75s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .intro-sub { animation-delay: 0.05s; }
        .intro-l1  { animation-delay: 0.2s; }
        .intro-l2  { animation-delay: 0.45s; }
      `}</style>

      <div
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black"
        style={{
          opacity: isClosing ? 0 : 1,
          transition: isClosing ? "opacity 0.78s ease-in" : "none",
          pointerEvents: isClosing ? "none" : "auto",
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />

        <div
          className="relative z-10 text-center px-6"
          style={{
            opacity: textOpacity,
            transform: isPunching
              ? `translateY(${textTranslateY}px) scale(1.08)`
              : `translateY(${textTranslateY}px) scale(1)`,
            transition: isPunching ? "transform 0.15s ease-out" : "none",
          }}
        >
          <p className="intro-line intro-sub mb-7 text-xs uppercase tracking-[0.38em] text-white/45 md:text-sm">
            La tienda líder en venta de videojuegos
          </p>
          <p
            className="intro-line intro-l1 font-display font-black uppercase leading-[0.9] tracking-[0.05em] text-white"
            style={{ fontSize: "clamp(2.8rem, 10vw, 7rem)" }}
          >
            EL JUEGO
          </p>
          <p
            className="intro-line intro-l2 font-display font-black uppercase leading-[0.9] tracking-[0.05em] text-gradient-neon animate-text-glow"
            style={{ fontSize: "clamp(2.8rem, 10vw, 7rem)" }}
          >
            EMPIEZA ACÁ.
          </p>
        </div>

        <div
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
          style={{ opacity: indicatorOpacity }}
        >
          <div className="flex h-16 w-10 items-center justify-center rounded-full border border-white/30">
            <ArrowDown className="h-4 w-4 animate-bounce text-white/70" />
          </div>
        </div>
      </div>
    </>
  );
};
