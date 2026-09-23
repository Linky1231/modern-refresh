import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { useNavigate } from "@/lib/router-compat";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
      className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <span className="font-display text-xl font-bold text-primary">404</span>
      </div>
      <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground">
        Página no encontrada
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        La página que buscas no existe o fue movida.
      </p>
      <Button className="mt-6 gap-1.5" onClick={() => navigate("/dashboard")}>
        <Home className="h-4 w-4" />
        Ir al inicio
      </Button>
    </motion.div>
  );
}
