import { motion } from "framer-motion";

const ease = [0.32, 0.72, 0, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease } },
};

export default function EditorPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="flex min-h-screen items-center justify-center px-6">
        <motion.div
          className="rounded-2xl border border-border/30 bg-card p-10 text-center"
          initial="hidden"
          animate="visible"
          variants={fadeUp}
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <svg
              viewBox="0 0 24 24"
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3v18M3 12h18" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Editor de juegos</h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            El editor está en construcción. Esta pantalla es el punto de entrada por ahora.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
