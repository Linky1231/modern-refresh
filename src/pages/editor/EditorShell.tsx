import { useNavigate } from "@/lib/router-compat";
import { motion } from "framer-motion";
import { ArrowLeft, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const ease = [0.32, 0.72, 0, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease } },
};

export function EditorShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-card/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 h-9 px-3"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4" />
              Atrás
            </Button>
            <span className="ml-2 text-base font-extrabold tracking-tight text-primary">
              Editor
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <Gamepad2 className="h-5 w-5 text-primary" />
            <span className="text-sm font-bold tracking-tight text-foreground">
              Asternal Editor
            </span>
          </div>
        </div>
      </nav>

      <main className="relative pt-16">
        <motion.div
          className="mx-auto min-h-[calc(100vh-4rem)] w-full px-6 py-6"
          initial="hidden"
          animate="visible"
          variants={fadeUp}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
