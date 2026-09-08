// Botón Seguir/Siguiendo reutilizable — usado en publicaciones (sm) y perfil (lg)
// Estados spec: Seguir = azul bg-blue-600 · Siguiendo = bg-slate-100 + border, hover rojo
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
      className={`shrink-0 rounded-full transition-all ${sizeCls} ${
        isFollowing
          ? "border border-slate-200 bg-slate-100 text-slate-700 font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200"
          : "bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm"
      }`}
    >
      {isFollowing ? "Siguiendo" : "Seguir"}
    </motion.button>
  );
}
