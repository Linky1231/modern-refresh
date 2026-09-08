// Modal de confirmación "Dejar de seguir" — usado en Feed y Perfil
// Spec exacto: Título ¿Dejar de seguir a @username? / Mensaje / Cancelar bg-slate-100 / Dejar de seguir bg-red-600
import { motion, AnimatePresence } from "framer-motion";
import { UserX } from "lucide-react";

interface UnfollowConfirmModalProps {
  open: boolean;
  username: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function UnfollowConfirmModal({ open, username, onConfirm, onCancel }: UnfollowConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="mx-4 w-full max-w-sm rounded-2xl border border-border/35 bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <UserX className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-card-foreground">
                  ¿Dejar de seguir a @{username}?
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Sus publicaciones ya no aparecerán en tu pestaña de Seguidos.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                Dejar de seguir
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
