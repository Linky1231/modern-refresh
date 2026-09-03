import { motion } from "framer-motion";
import { Code2, Rocket, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@/lib/router-compat";

// ── Animation variants ──────────────────────────────────────────────
// Ease: [0.32, 0.72, 0, 1] — smooth deceleration (design system standard)
const ease = [0.32, 0.72, 0, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.08,
      duration: 0.45,
      ease,
    },
  }),
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: (i: number) => ({
    opacity: 1,
    transition: {
      delay: i * 0.08,
      duration: 0.4,
      ease,
    },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: i * 0.1,
      duration: 0.4,
      ease,
    },
  }),
};

// ── Data ────────────────────────────────────────────────────────────
const features = [
  {
    icon: Rocket,
    title: "Un motor de juegos propio",
    desc: "Haz realidad tus ideas y crea tus propios juegos.",
  },
  {
    icon: Code2,
    title: "Una red social integrada",
    desc: "Comparte tus creaciones y conecta con otros desarrolladores.",
  },
];

// ── Component ───────────────────────────────────────────────────────
export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* ── Navbar ──────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <img
              src="/assets/67385.png"
              alt="Asternal"
              className="h-9 w-9 rounded-xl object-contain"
            />
            <span className="text-xl font-extrabold tracking-tight text-primary">
              Asternal
            </span>
          </div>
          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            <Button size="sm" className="gap-1.5" onClick={() => navigate("/auth?mode=register")}>
              Comenzar <ChevronRight className="h-4 w-4" />
            </Button>
          </motion.div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative flex min-h-[85vh] items-center justify-center px-6 pt-20 pb-8">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeIn}
            custom={0}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-4 py-1.5 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Engine v1 — open beta
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
          >
            Ser desarrollador{" "}
            <span className="text-primary">nunca fue tan fácil</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
          >
            Una plataforma todo en uno para crear, aprender y crecer
            como desarrollador de videojuegos.
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={3}
          >
            <motion.div
              className="w-full sm:w-auto"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <Button
                size="lg"
                className="w-full gap-2 px-8 sm:w-auto"
                onClick={() => navigate("/auth?mode=register")}
              >
                Crear cuenta
                <ChevronRight className="h-4 w-4" />
              </Button>
            </motion.div>
            <motion.div
              className="w-full sm:w-auto"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <Button
                size="lg"
                variant="outline"
                className="w-full gap-2 px-8 sm:w-auto"
                onClick={() => navigate("/auth?mode=login&returnTo=/dashboard")}
              >
                Iniciar sesión
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section className="relative border-t border-border/50 bg-muted/30 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            className="text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={fadeUp}
            custom={0}
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              Herramientas
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Crea, comparte y desarrolla
            </h2>
          </motion.div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 max-w-3xl mx-auto">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
                variants={scaleIn}
                custom={i}
                whileHover={{ y: -3 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="group rounded-2xl border border-border/60 bg-card p-8 transition-colors hover:border-primary/30 hover:bg-accent/50"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-border/50 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <img
              src="/assets/67385.png"
              alt="Asternal"
              className="h-4 w-4 rounded object-contain"
            />
            Asternal
          </div>
          <p className="text-xs text-muted-foreground/60">
            &copy; {new Date().getFullYear()} Asternal. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
