// Botón Seguir/Siguiendo reutilizable — usado en publicaciones (sm) y perfil (lg)
// ▶ El color de fondo hereda del tema de la app: usa el token --primary (el MISMO
//   azul de marca del botón central '+', del botón Publicar y del logo), no un
//   azul fijo. Si el tema cambia, el botón cambia con él.
// Estados:
//  · Seguir:     bg-primary text-primary-foreground (hover levemente más oscuro)
//  · Siguiendo:  bg-slate-100 + border-slate-200, hover rojo (acción destructiva)
import { motion } from "framer-motion";

interface FollowButtonProps {
  isFollowing: boolean;
  /** Se ejecuta al pulsar "Seguir" (acción inmediata). */
  onFollow: () => void;
  /** Se ejecuta al pulsar "Siguiendo" (debe abrir el modal de confirmación). */
  onUnfollowRequest: () => void;
  /** sm = publicaciones (px-3 py-1 text-xs) · lg = perfil (px-6 py-2 text-sm) */
  size?: "sm" | "lg";
}

export function FollowButton({ isFollowing, onFollow, onUnfollowRequest, size = "sm" }: FollowButtonProps) {
  const sizeCls = size === "lg" ? "px-6 py-2 text-sm" : "px-3 py-1 text-xs";
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      whileHover={{ scale: size === "lg" ? 1.02 : 1.05 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      onClick={() => (isFollowing ? onUnfollowRequest() : onFollow())}
      className={`shrink-0 rounded-full transition-colors ${sizeCls} ${
        isFollowing
          ? "border border-slate-200 bg-slate-100 text-slate-700 font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200"
          : "bg-primary text-primary-foreground font-semibold shadow-sm hover:bg-primary/90"
      }`}
    >
      {isFollowing ? "Siguiendo" : "Seguir"}
    </motion.button>
  );
}
