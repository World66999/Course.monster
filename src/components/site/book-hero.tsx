"use client";

import * as React from "react";
import Link from "next/link";
import {
  motion,
  useReducedMotion,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  FolderOpen,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/button";
import { AnimatedCounter } from "@/components/site/animated-counter";

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface BookHeroProps {
  siteName: string;
  description: string;
  stats: { courses: number; downloads: number; categories: number };
}

/* ─── Page content ────────────────────────────────────────────────────────── */

const BOOK_PAGES = [
  {
    id: "welcome",
    eyebrow: "Welcome to",
    title: "CourseVault",
    body: "Your gateway to unlimited learning.\nPremium courses, always free.",
  },
  {
    id: "discover",
    eyebrow: "Discover",
    title: "Browse & Download",
    body: "Curated collections across every\ndiscipline — from code to design.",
    cta: { label: "Browse courses", href: "/courses" },
  },
  {
    id: "learn",
    eyebrow: "Start learning",
    title: "How it works",
    body: "No paywalls. No signup required.\nJust pick a course and download.",
    cta: { label: "Learn how", href: "/how-to-download" },
  },
] as const;

/* ─── Easing ──────────────────────────────────────────────────────────────── */

const EASE_CINEMATIC = [0.22, 1, 0.36, 1] as const;
const EASE_BOOK_OPEN = [0.16, 1, 0.3, 1] as const;

/* ─── Fine pointer detection (shared with interactive.tsx pattern) ─────── */

function useFinePointer() {
  const [fine, setFine] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const on = () => setFine(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return fine;
}

/* ─── Book Hero ───────────────────────────────────────────────────────────── */

export function BookHero({ siteName, description, stats }: BookHeroProps) {
  const reduce = useReducedMotion();
  const finePointer = useFinePointer();

  /* ── State ── */
  const [phase, setPhase] = React.useState<"closed" | "opening" | "open">(
    reduce ? "open" : "closed"
  );
  const [[activePage, direction], setPage] = React.useState([0, 1]);
  const [hasEntrance, setHasEntrance] = React.useState(!!reduce);
  const [isPaused, setIsPaused] = React.useState(false);


  /* ── Mouse tracking for parallax ── */
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useSpring(mouseX, { stiffness: 50, damping: 20, mass: 1 });
  const smoothY = useSpring(mouseY, { stiffness: 50, damping: 20, mass: 1 });

  // Book tilt from mouse
  const bookRotateY = useTransform(smoothX, [-1, 1], [5, -5]);
  const bookRotateX = useTransform(smoothY, [-1, 1], [-3, 3]);

  // Light position follows mouse
  const lightX = useTransform(smoothX, [-1, 1], ["30%", "70%"]);
  const lightY = useTransform(smoothY, [-1, 1], ["20%", "60%"]);

  // Reflection streak position
  const reflectionPos = useTransform(smoothX, [-1, 1], ["-20%", "120%"]);

  const containerRef = React.useRef<HTMLDivElement>(null);

  /* ── 3D Page Turn Physics ── */
  /* ── Premium Smooth Fade-Through Transition ── */
  const cinematicTransition = { duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };
  
  const flipVariants = {
    enter: (d: number) => ({
      opacity: 0,
      x: d > 0 ? 30 : -30,
      scale: 0.95,
      filter: "blur(8px)",
    }),
    center: {
      opacity: 1,
      x: 0,
      scale: 1,
      filter: "blur(0px)",
      transition: cinematicTransition,
    },
    exit: (d: number) => ({
      opacity: 0,
      x: d > 0 ? -30 : 30,
      scale: 0.95,
      filter: "blur(8px)",
      transition: cinematicTransition,
    }),
  };

  const leftFlipVariants = flipVariants;
  const rightFlipVariants = flipVariants;

  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (reduce || !finePointer) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      mouseX.set(x);
      mouseY.set(y);
    },
    [reduce, finePointer, mouseX, mouseY]
  );

  const handleMouseLeave = React.useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  /* ── Animation sequence ── */
  React.useEffect(() => {
    if (reduce) return;
    const t1 = setTimeout(() => setHasEntrance(true), 200);
    const t2 = setTimeout(() => setPhase("opening"), 2000);
    const t3 = setTimeout(() => setPhase("open"), 4200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [reduce]);

  /* ── Page navigation ── */
  const paginate = React.useCallback((newDirection: number) => {
    setPage((prev) => {
      let next = prev[0] + newDirection;
      if (next < 0) next = BOOK_PAGES.length - 1;
      if (next > BOOK_PAGES.length - 1) next = 0;
      return [next, newDirection];
    });
  }, []);

  const goToPage = React.useCallback((targetPage: number) => {
    setPage((prev) => {
      if (targetPage === prev[0]) return prev;
      return [targetPage, targetPage > prev[0] ? 1 : -1];
    });
  }, []);

  /* ── Autoplay ── */
  React.useEffect(() => {
    if (phase !== "open" || reduce || isPaused) return;
    // Paused while the tab is hidden. Left running, the carousel kept firing
    // state updates for a hero nobody was looking at, and a visitor coming back
    // from another tab found it several pages along from where they left it.
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer === null) timer = setInterval(() => paginate(1), 7000);
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [phase, reduce, isPaused, paginate]);

  const isOpen = phase === "open";
  const canTrackMouse = finePointer && !reduce;

  /* ── Cover rotation angle ── */
  const coverAngle =
    phase === "closed" ? 0 : phase === "opening" ? -100 : -175;

  return (
    <div className="relative isolate min-h-[100dvh] overflow-hidden">
      {/* ── Background ── */}
      <div className="absolute inset-0 -z-30 bg-background" />

      {/* Ambient glow: three offset radials for dimension */}
      <motion.div
        className="pointer-events-none absolute inset-0 -z-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2.5, delay: 0.1 }}
        aria-hidden
      >
        <div
          className="absolute left-1/2 top-[20%] h-[50rem] w-[70rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(ellipse at center, color-mix(in srgb, var(--primary) 18%, transparent), transparent 65%)",
          }}
        />
        <div
          className="absolute -right-20 top-[10%] h-[35rem] w-[45rem] rounded-full"
          style={{
            background:
              "radial-gradient(ellipse at center, color-mix(in srgb, var(--accent) 14%, transparent), transparent 65%)",
          }}
        />
        <div
          className="absolute -left-20 bottom-[5%] h-[30rem] w-[40rem] rounded-full"
          style={{
            background:
              "radial-gradient(ellipse at center, color-mix(in srgb, var(--primary) 10%, transparent), transparent 70%)",
          }}
        />
      </motion.div>

      {/* Dot field */}
      <div className="bg-dots pointer-events-none absolute inset-0 -z-10 opacity-30" aria-hidden />

      {/* Grain */}
      <div className="noise pointer-events-none absolute inset-0 -z-10" aria-hidden />

      {/* ── Scene ── */}
      <div
        ref={containerRef}
        className="relative flex min-h-[100dvh] flex-col items-center justify-center px-4 py-20 sm:px-6 lg:py-24"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* ── Badge ── */}
        <motion.div
          className="mb-8 sm:mb-12"
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          animate={hasEntrance ? { opacity: 1, y: 0, filter: "blur(0px)" } : undefined}
          transition={{ duration: 0.8, ease: EASE_CINEMATIC, delay: 0.15 }}
        >
          <span className="glass-veil inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium text-muted-foreground shadow-soft">
            <Sparkles className="h-4 w-4 text-accent" aria-hidden />
            <span className="numeric font-semibold text-foreground">{stats.courses}+</span>
            premium courses, always free
          </span>
        </motion.div>

        {/* ── 3D Book ── */}
        <motion.div
          className="relative w-full max-w-[52rem]"
          style={{
            perspective: "2200px",
            perspectiveOrigin: "50% 42%",
          }}
          initial={{ opacity: 0, scale: 0.8, filter: "blur(12px)" }}
          animate={
            hasEntrance
              ? { opacity: 1, scale: 1, filter: "blur(0px)" }
              : undefined
          }
          transition={{ duration: 1.6, ease: EASE_CINEMATIC, delay: 0.35 }}
        >
          {/* Mouse-following ambient light */}
          {canTrackMouse && (
            <motion.div
              className="pointer-events-none absolute -z-10 h-[35rem] w-[45rem] rounded-full opacity-15 blur-[120px]"
              style={{
                background:
                  "radial-gradient(ellipse at center, color-mix(in srgb, var(--primary) 40%, transparent), transparent 65%)",
                left: lightX,
                top: lightY,
                transform: "translate(-50%, -50%)",
              }}
              aria-hidden
            />
          )}

          {/* Book assembly — the 3D-transformed group */}
          <motion.div
            className="relative mx-auto"
            style={{
              transformStyle: "preserve-3d",
              ...(canTrackMouse
                ? { rotateY: bookRotateY, rotateX: bookRotateX }
                : {}),
            }}
          >
            {/* ── Book body ── */}
            <motion.div
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              className={cn(
                "relative mx-auto",
                "w-full max-w-[24rem] sm:max-w-none sm:w-[36rem] md:w-[42rem] lg:w-[48rem]",
                "aspect-[4/5] sm:aspect-[3/2]"
              )}
              style={{ transformStyle: "preserve-3d" }}
              animate={
                reduce
                  ? {}
                  : {
                      y: [0, -10, 0],
                    }
              }
              transition={{
                y: {
                  duration: 7,
                  ease: "easeInOut",
                  repeat: Infinity,
                  repeatType: "loop",
                },
              }}
            >
              {/* ── Ground shadow ── */}
              <motion.div
                className="absolute -bottom-8 left-[10%] right-[10%] h-16 rounded-[50%] blur-3xl"
                style={{
                  background:
                    "radial-gradient(ellipse at center, rgba(0,0,0,0.3), transparent 70%)",
                }}
                animate={{
                  opacity: isOpen ? 0.25 : 0.5,
                  scaleX: isOpen ? 1.25 : 1,
                  scaleY: isOpen ? 0.8 : 1,
                }}
                transition={{ duration: 2, ease: EASE_BOOK_OPEN }}
                aria-hidden
              />

              {/* ── Back cover ── */}
              <div
                className="absolute inset-0 rounded-r-lg rounded-l-[4px]"
                style={{
                  transformStyle: "preserve-3d",
                  transform: "translateZ(-8px)",
                  background: `linear-gradient(145deg,
                    color-mix(in srgb, var(--primary) 12%, var(--card)) 0%,
                    color-mix(in srgb, var(--primary) 6%, var(--card)) 60%,
                    color-mix(in srgb, var(--accent) 4%, var(--card)) 100%)`,
                  border: "1px solid var(--glass-border)",
                  boxShadow: `
                    inset 0 1px 0 0 var(--edge-light),
                    0 4px 12px rgba(0,0,0,0.08),
                    0 12px 40px rgba(0,0,0,0.06)
                  `,
                }}
              >
                {/* Spine accent */}
                <div
                  className="absolute inset-y-0 left-0 w-1 rounded-l-[4px]"
                  style={{
                    background: `linear-gradient(180deg,
                      color-mix(in srgb, var(--primary) 50%, transparent),
                      color-mix(in srgb, var(--primary) 25%, transparent) 50%,
                      color-mix(in srgb, var(--accent) 35%, transparent))`,
                  }}
                />
              </div>

              {/* ── Page stack edges (3D depth) ── */}
              {[5, 4, 3, 2, 1].map((i) => (
                <motion.div
                  key={`page-${i}`}
                  className="absolute inset-0 rounded-r-md rounded-l-[3px]"
                  style={{
                    transformStyle: "preserve-3d",
                    transform: `translateZ(${-i * 1.3}px)`,
                    background: `linear-gradient(90deg,
                      color-mix(in srgb, var(--card) 95%, var(--primary)) 0%,
                      var(--card) 100%)`,
                    border: "1px solid var(--glass-border)",
                    opacity: 0.3 + i * 0.12,
                  }}
                  animate={{
                    opacity: isOpen ? 0 : 0.3 + i * 0.12,
                  }}
                  transition={{
                    duration: 0.9,
                    delay: i * 0.04,
                    ease: EASE_CINEMATIC,
                  }}
                />
              ))}

              {/* ── FRONT COVER (hinges open from left) ── */}
              <motion.div
                className="absolute inset-0 overflow-hidden rounded-r-lg rounded-l-[4px]"
                style={{
                  transformStyle: "preserve-3d",
                  transformOrigin: "left center",
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  willChange: "transform",
                }}
                animate={{ rotateY: coverAngle }}
                transition={{
                  duration: reduce ? 0 : 2.5,
                  ease: EASE_BOOK_OPEN,
                }}
              >
                {/* Cover glass surface */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(140deg,
                      color-mix(in srgb, var(--card) 88%, transparent) 0%,
                      color-mix(in srgb, var(--card) 70%, transparent) 35%,
                      color-mix(in srgb, var(--primary) 8%, var(--card)) 70%,
                      color-mix(in srgb, var(--accent) 5%, var(--card)) 100%)`,
                    backdropFilter: "blur(24px) saturate(170%)",
                    WebkitBackdropFilter: "blur(24px) saturate(170%)",
                    border: "1px solid var(--glass-border)",
                    boxShadow: `
                      inset 0 1px 0 0 var(--edge-light),
                      inset 0 -1px 0 0 rgba(0,0,0,0.03),
                      0 8px 24px rgba(0,0,0,0.1),
                      0 20px 60px rgba(0,0,0,0.07)
                    `,
                  }}
                >
                  {/* Decorative corner accents */}
                  <div
                    className="absolute top-0 left-0 h-24 w-24 opacity-20 sm:h-32 sm:w-32"
                    style={{
                      background: `linear-gradient(135deg,
                        color-mix(in srgb, var(--primary) 35%, transparent),
                        transparent)`,
                      borderRadius: "0 0 100% 0",
                    }}
                    aria-hidden
                  />
                  <div
                    className="absolute bottom-0 right-0 h-24 w-24 opacity-15 sm:h-32 sm:w-32"
                    style={{
                      background: `linear-gradient(315deg,
                        color-mix(in srgb, var(--accent) 30%, transparent),
                        transparent)`,
                      borderRadius: "100% 0 0 0",
                    }}
                    aria-hidden
                  />

                  {/* Embossed decorative lines */}
                  <div
                    className="absolute inset-x-6 top-5 h-px opacity-15 sm:inset-x-10 sm:top-7"
                    style={{
                      background: `linear-gradient(90deg, transparent 5%, color-mix(in srgb, var(--primary) 50%, transparent), transparent 95%)`,
                    }}
                    aria-hidden
                  />
                  <div
                    className="absolute inset-x-6 bottom-5 h-px opacity-15 sm:inset-x-10 sm:bottom-7"
                    style={{
                      background: `linear-gradient(90deg, transparent 5%, color-mix(in srgb, var(--primary) 50%, transparent), transparent 95%)`,
                    }}
                    aria-hidden
                  />
                  {/* Vertical decorative lines */}
                  <div
                    className="absolute inset-y-6 left-5 w-px opacity-10 sm:inset-y-10 sm:left-7"
                    style={{
                      background: `linear-gradient(180deg, transparent 5%, color-mix(in srgb, var(--primary) 40%, transparent), transparent 95%)`,
                    }}
                    aria-hidden
                  />
                  <div
                    className="absolute inset-y-6 right-5 w-px opacity-10 sm:inset-y-10 sm:right-7"
                    style={{
                      background: `linear-gradient(180deg, transparent 5%, color-mix(in srgb, var(--primary) 40%, transparent), transparent 95%)`,
                    }}
                    aria-hidden
                  />

                  {/* Cover content */}
                  <motion.div
                    className="relative flex h-full flex-col items-center justify-center p-8 sm:p-14"
                    animate={{
                      opacity: phase === "closed" ? 1 : 0,
                    }}
                    transition={{ duration: 0.4 }}
                  >
                    <BookOpen
                      className="h-9 w-9 text-primary/50 sm:h-12 sm:w-12"
                      aria-hidden
                    />
                    <h1 className="mt-4 text-display text-balance text-center leading-[1.02]">
                      <span className="block">{siteName}</span>
                    </h1>
                    <p className="mt-3 max-w-md text-center text-lead text-pretty text-muted-foreground">
                      {description}
                    </p>
                    <motion.p
                      className="mt-6 text-xs font-medium text-muted-foreground/50 uppercase tracking-[0.2em]"
                      animate={{ opacity: [0.3, 0.7, 0.3] }}
                      transition={{
                        duration: 2.8,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      ✦ click to open
                    </motion.p>
                  </motion.div>

                  {/* Glass reflection streak */}
                  <motion.div
                    className="pointer-events-none absolute inset-0 overflow-hidden"
                    animate={{
                      opacity: phase === "closed" ? 1 : 0,
                    }}
                    transition={{ duration: 0.8 }}
                    aria-hidden
                  >
                    <motion.div
                      className="absolute inset-y-0 w-[30%]"
                      style={{
                        left: canTrackMouse ? reflectionPos : "45%",
                        background: `linear-gradient(90deg,
                          transparent,
                          rgba(255,255,255,0.06) 30%,
                          rgba(255,255,255,0.12) 50%,
                          rgba(255,255,255,0.06) 70%,
                          transparent)`,
                        transform: "skewX(-12deg)",
                      }}
                    />
                  </motion.div>
                </div>

                {/* Click handler on cover to open the book */}
                {phase === "closed" && (
                  <button
                    className="absolute inset-0 cursor-pointer z-10"
                    onClick={() => {
                      if (reduce) {
                        setPhase("open");
                      } else {
                        setPhase("opening");
                        setTimeout(() => setPhase("open"), 2400);
                      }
                    }}
                    aria-label="Open the book"
                  />
                )}
              </motion.div>

              {/* ── Inner pages (revealed as book opens) ── */}
              <motion.div
                className="absolute inset-0 overflow-hidden rounded-r-lg rounded-l-[4px]"
                style={{ transformStyle: "preserve-3d" }}
                animate={{
                  opacity: phase === "closed" ? 0 : 1,
                }}
                transition={{
                  duration: 0.8,
                  delay: phase === "closed" ? 0 : 0.6,
                  ease: EASE_CINEMATIC,
                }}
              >
                {/* ── Left page (Desktop only) ── */}
                <div
                  className="hidden sm:block absolute inset-y-0 left-0 w-1/2 overflow-hidden"
                  style={{
                    background: `linear-gradient(100deg,
                      color-mix(in srgb, var(--card) 96%, transparent) 0%,
                      color-mix(in srgb, var(--card) 90%, transparent) 100%)`,
                    backdropFilter: "blur(28px) saturate(160%)",
                    WebkitBackdropFilter: "blur(28px) saturate(160%)",
                    borderRight: "1px solid var(--glass-border)",
                    boxShadow: `
                      inset 0 1px 0 0 var(--edge-light),
                      inset -3px 0 12px rgba(0,0,0,0.02)
                    `,
                  }}
                >
                  {/* Spine shadow on left page */}
                  <div
                    className="absolute inset-y-0 left-0 w-6"
                    style={{
                      background:
                        "linear-gradient(90deg, rgba(0,0,0,0.05), transparent)",
                    }}
                    aria-hidden
                  />

                  {/* Subtle page texture lines */}
                  <div
                    className="pointer-events-none absolute inset-0 opacity-[0.03]"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(0deg, transparent, transparent 1.5rem, var(--foreground) 1.5rem, var(--foreground) calc(1.5rem + 1px))",
                    }}
                    aria-hidden
                  />

                  {/* Left page content */}
                  <div className="relative flex h-full flex-col items-center justify-center p-5 sm:p-10" style={{ perspective: "1200px" }}>
                    <AnimatePresence custom={direction} initial={false}>
                      <motion.div
                        key={`left-${activePage}`}
                        custom={direction}
                        className="absolute inset-0 flex flex-col items-center text-center origin-right p-5 sm:p-10 justify-center"
                        style={{ backfaceVisibility: "hidden" }}
                        variants={leftFlipVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{
                          duration: 0.7,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      >
                        <p className="text-eyebrow text-primary uppercase tracking-[0.15em]">
                          {BOOK_PAGES[activePage].eyebrow}
                        </p>
                        <h2 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl md:text-heading text-balance">
                          {BOOK_PAGES[activePage].title}
                        </h2>
                        <div
                          className="mx-auto mt-2 h-px w-12 opacity-25"
                          style={{
                            background: `linear-gradient(90deg, transparent, var(--primary), transparent)`,
                          }}
                          aria-hidden
                        />
                        <p className="mt-4 text-xs sm:text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                          {BOOK_PAGES[activePage].body}
                        </p>
                        {"cta" in BOOK_PAGES[activePage] &&
                          BOOK_PAGES[activePage].cta && (
                            <Link
                              href={BOOK_PAGES[activePage].cta!.href}
                              className={buttonClasses(
                                "primary",
                                "md",
                                "mt-6 group"
                              )}
                            >
                              {BOOK_PAGES[activePage].cta!.label}
                              <ArrowRight
                                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                                aria-hidden
                              />
                            </Link>
                          )}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>

                {/* ── Right page (Full page on mobile, Right half on desktop) ── */}
                <div
                  className="absolute inset-0 sm:inset-y-0 sm:left-auto sm:right-0 sm:w-1/2 overflow-hidden"
                  style={{
                    background: `linear-gradient(260deg,
                      color-mix(in srgb, var(--card) 96%, transparent) 0%,
                      color-mix(in srgb, var(--card) 90%, transparent) 100%)`,
                    backdropFilter: "blur(28px) saturate(160%)",
                    WebkitBackdropFilter: "blur(28px) saturate(160%)",
                    boxShadow: `
                      inset 0 1px 0 0 var(--edge-light),
                      inset 3px 0 12px rgba(0,0,0,0.02)
                    `,
                  }}
                >
                  {/* Binding shadow on right page */}
                  <div
                    className="absolute inset-y-0 right-0 w-4 hidden sm:block"
                    style={{
                      background:
                        "linear-gradient(270deg, rgba(0,0,0,0.03), transparent)",
                    }}
                    aria-hidden
                  />
                  {/* Mobile spine shadow */}
                  <div
                    className="absolute inset-y-0 left-0 w-6 sm:hidden"
                    style={{
                      background:
                        "linear-gradient(90deg, rgba(0,0,0,0.05), transparent)",
                    }}
                    aria-hidden
                  />

                  {/* Page texture lines */}
                  <div
                    className="pointer-events-none absolute inset-0 opacity-[0.03]"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(0deg, transparent, transparent 1.5rem, var(--foreground) 1.5rem, var(--foreground) calc(1.5rem + 1px))",
                    }}
                    aria-hidden
                  />

                  {/* Right page content (Mobile: Stacked Text + Stats, Desktop: Stats only) */}
                  <div className="relative flex h-full flex-col p-5 sm:items-center sm:justify-center sm:p-10" style={{ perspective: "1200px" }}>
                    <AnimatePresence custom={direction} initial={false}>
                      <motion.div
                        key={`right-${activePage}`}
                        custom={direction}
                        className="absolute inset-0 flex w-full flex-col gap-5 sm:gap-5 overflow-y-auto sm:overflow-visible pb-6 sm:pb-0 origin-left p-5 sm:p-10"
                        style={{ scrollbarWidth: "none", backfaceVisibility: "hidden" }}
                        variants={rightFlipVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{
                          duration: 0.7,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      >
                        {/* ── Mobile-only Intro Text ── */}
                        <div className="flex flex-col items-center text-center sm:hidden mt-2 mb-2">
                          <p className="text-[10px] text-primary uppercase tracking-[0.15em]">
                            {BOOK_PAGES[activePage].eyebrow}
                          </p>
                          <h2 className="mt-2 text-lg font-bold tracking-tight text-balance">
                            {BOOK_PAGES[activePage].title}
                          </h2>
                          <div
                            className="mx-auto mt-2 h-px w-8 opacity-25"
                            style={{
                              background: `linear-gradient(90deg, transparent, var(--primary), transparent)`,
                            }}
                            aria-hidden
                          />
                          <p className="mt-3 text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                            {BOOK_PAGES[activePage].body}
                          </p>
                          {"cta" in BOOK_PAGES[activePage] && BOOK_PAGES[activePage].cta && (
                            <Link
                              href={BOOK_PAGES[activePage].cta!.href}
                              className={buttonClasses("primary", "sm", "mt-4 group")}
                            >
                              {BOOK_PAGES[activePage].cta!.label}
                              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                            </Link>
                          )}
                        </div>

                        {/* ── Shared Visual Stats/Features ── */}
                        {activePage === 0 ? (
                          /* ── Stats ── */
                          <>
                            {[
                              {
                                icon: BookOpen,
                                label: "Courses",
                                value: stats.courses,
                              },
                              {
                                icon: Download,
                                label: "Downloads",
                                value: stats.downloads,
                              },
                              {
                                icon: FolderOpen,
                                label: "Categories",
                                value: stats.categories,
                              },
                            ].map(({ icon: Icon, label, value }) => (
                              <div
                                key={label}
                                className="flex items-center gap-3 rounded-card p-3 sm:p-4 transition-colors duration-300"
                                style={{
                                  background:
                                    "color-mix(in srgb, var(--primary-soft) 35%, transparent)",
                                  border: "1px solid var(--glass-border)",
                                  boxShadow: "inset 0 1px 0 0 var(--edge-light)",
                                }}
                              >
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary sm:h-10 sm:w-10">
                                  <Icon
                                    className="h-4 w-4 sm:h-5 sm:w-5"
                                    aria-hidden
                                  />
                                </span>
                                <div>
                                  <dd className="numeric text-lg font-bold tracking-tight sm:text-2xl">
                                    <AnimatedCounter value={value} />
                                  </dd>
                                  <dt className="text-[0.625rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase sm:text-eyebrow">
                                    {label}
                                  </dt>
                                </div>
                              </div>
                            ))}
                          </>
                        ) : activePage === 1 ? (
                          /* ── Features ── */
                          <>
                            {[
                              { emoji: "⚡", text: "Fast, protected downloads" },
                              {
                                emoji: "✓",
                                text: "Verified & organized content",
                              },
                              { emoji: "∞", text: "Free forever, no strings" },
                              {
                                emoji: "🎓",
                                text: "Every discipline covered",
                              },
                            ].map(({ emoji, text }) => (
                              <div
                                key={text}
                                className="flex items-center gap-3 rounded-nested p-2.5 sm:p-3 transition-colors duration-300"
                                style={{
                                  background:
                                    "color-mix(in srgb, var(--primary-soft) 25%, transparent)",
                                  border: "1px solid var(--glass-border)",
                                  boxShadow:
                                    "inset 0 1px 0 0 var(--edge-light)",
                                }}
                              >
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-primary-soft text-sm">
                                  {emoji}
                                </span>
                                <span className="text-xs font-medium sm:text-sm">
                                  {text}
                                </span>
                              </div>
                            ))}
                          </>
                        ) : (
                          /* ── Steps ── */
                          <>
                            {[
                              { step: "01", text: "Find your course" },
                              { step: "02", text: "Click download" },
                              { step: "03", text: "Start learning" },
                            ].map(({ step, text }) => (
                              <div
                                key={step}
                                className="flex items-center gap-3 rounded-nested p-3 sm:p-4 transition-colors duration-300"
                                style={{
                                  background:
                                    "color-mix(in srgb, var(--primary-soft) 25%, transparent)",
                                  border: "1px solid var(--glass-border)",
                                  boxShadow:
                                    "inset 0 1px 0 0 var(--edge-light)",
                                }}
                              >
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold sm:h-10 sm:w-10 sm:text-sm">
                                  {step}
                                </span>
                                <span className="text-xs font-medium sm:text-sm">
                                  {text}
                                </span>
                              </div>
                            ))}
                          </>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>

                {/* ── Center spine crease ── */}
                <div
                  className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2"
                  aria-hidden
                >
                  {/* Main crease line */}
                  <div
                    className="absolute inset-y-0 left-0 w-[1.5px]"
                    style={{
                      background: `linear-gradient(180deg,
                        transparent 3%,
                        var(--glass-border) 15%,
                        var(--border) 50%,
                        var(--glass-border) 85%,
                        transparent 97%)`,
                    }}
                  />
                  {/* Wider shadow for depth */}
                  <div
                    className="absolute inset-y-0 -left-3 w-8"
                    style={{
                      background: `linear-gradient(90deg,
                        transparent,
                        rgba(0,0,0,0.025) 25%,
                        rgba(0,0,0,0.05) 50%,
                        rgba(0,0,0,0.025) 75%,
                        transparent)`,
                    }}
                  />
                </div>
              </motion.div>

              {/* ── Glass reflection overlay (whole book surface) ── */}
              <motion.div
                className="pointer-events-none absolute inset-0 rounded-r-lg rounded-l-[4px] overflow-hidden"
                animate={{ opacity: isOpen ? 0.4 : 0.7 }}
                transition={{ duration: 2 }}
                aria-hidden
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(155deg,
                      rgba(255,255,255,0.1) 0%,
                      transparent 35%,
                      transparent 65%,
                      rgba(255,255,255,0.04) 100%)`,
                  }}
                />
                {/* Edge highlight — the tiny refraction along the top edge */}
                <div
                  className="absolute inset-x-0 top-0 h-px"
                  style={{
                    background: `linear-gradient(90deg, transparent 10%, var(--edge-light), transparent 90%)`,
                  }}
                />
              </motion.div>

              {/* ── Outer border ring (glass edge) ── */}
              <div
                className="pointer-events-none absolute inset-0 rounded-r-lg rounded-l-[4px]"
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow:
                    "0 0 0 1px var(--glass-border)",
                }}
                aria-hidden
              />
            </motion.div>
          </motion.div>
        </motion.div>

        {/* ── Page navigation dots ── */}
        <motion.nav
          className="mt-8 flex items-center gap-3 sm:mt-10"
          aria-label="Book pages"
          initial={{ opacity: 0, y: 16 }}
          animate={
            isOpen ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }
          }
          transition={{
            duration: 0.6,
            ease: EASE_CINEMATIC,
            delay: isOpen ? 0.4 : 0,
          }}
        >
        <div className="absolute inset-x-0 bottom-6 flex justify-center">
          <div className="glass-chrome flex items-center gap-4 rounded-full px-5 py-2.5">
            <button
              type="button"
              onClick={() => paginate(-1)}
              disabled={activePage === 0}
              className="tap-target flex h-8 w-8 items-center justify-center rounded-full bg-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <div
              className="flex items-center gap-2"
              role="tablist"
              aria-label="Book pages"
            >
              {BOOK_PAGES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === activePage}
                  onClick={() => goToPage(i)}
                  className={cn(
                    // 32px dots in a `gap-2` row: a 44px hit box extends 6px each
                    // side, so at 8px of gap the boxes stay 2px apart and no dot
                    // can steal its neighbour's tap.
                    "tap-target relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-xs sm:text-sm font-semibold transition-[transform,background-color,color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    i === activePage
                      ? "bg-primary text-primary-foreground shadow-[0_0_20px_color-mix(in_srgb,var(--primary)_30%,transparent)] scale-110"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  aria-label={`Page ${i + 1}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => paginate(1)}
              disabled={activePage === BOOK_PAGES.length - 1}
              className="tap-target flex h-8 w-8 items-center justify-center rounded-full bg-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Next page"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div></motion.nav>

        {/* ── Scroll indicator ── */}
        <motion.div
          className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 sm:bottom-8"
          initial={{ opacity: 0 }}
          animate={isOpen ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5, delay: isOpen ? 1 : 0 }}
        >
          <span className="text-[0.625rem] font-medium text-muted-foreground/50 uppercase tracking-[0.2em]">
            Scroll to explore
          </span>
          <motion.div
            className="flex h-7 w-[18px] items-start justify-center rounded-full border-[1.5px] border-muted-foreground/25 pt-1.5"
            aria-hidden
          >
            <motion.div
              className="h-1 w-1 rounded-full bg-muted-foreground/40"
              animate={{ y: [0, 7, 0] }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
