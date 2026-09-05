import { useNavigate } from "@/lib/router-compat";
import { motion } from "framer-motion";
import { ArrowLeft, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const ease = [0.32, 0.72, 0, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease } },
};

export default function EditorPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
            <span className="ml-2 text-xl font-extrabold tracking-tight text-primary">
              Editor
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <Gamepad2 className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold tracking-tight text-foreground">
              Asternal Editor
            </span>
          </div>
        </div>
      </nav>

      <main className="relative flex min-h-screen items-center justify-center px-6 pt-20">
        <motion.div
          className="mx-auto max-w-lg text-center"
          initial="hidden"
          animate="visible"
          variants={fadeUp}
        >
          <div className="rounded-2xl border border-border/40 bg-card p-10">
            <Gamepad2 className="mx-auto h-12 w-12 text-primary" />
            <h1 className="mt-4 text-2xl font-bold tracking-tight">
              Editor de juegos
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Aquí es donde crearás y editarás tus juegos.
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
