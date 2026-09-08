// Botón Seguir/Siguiendo reutilizable — UNICO en toda la app (feed + perfil)
// Spec de marca:
//  · No seguido: bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-1.5 rounded-full shadow-sm transition-colors
//  · Siguiendo:  bg-slate-100 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-700 font-medium text-xs px-4 py-1.5 rounded-full border border-slate-200 transition-colors
//  · "Siguiendo" muestra "Dejar de seguir" al hover (texto opcional del spec)
import { useState } from "react";

interface FollowButtonProps {
  isFollowing: boolean;
  /** Se ejecuta al pulsar "Seguir" (acción inmediata). */
  onFollow: () => void;
  /** Se ejecuta al pulsar "Siguiendo" (abre el modal de confirmación). */
  onUnfollowRequest: () => void;
  disabled?: boolean;
}

export function FollowButton({ isFollowing, onFollow, onUnfollowRequest, disabled }: FollowButtonProps) {
  const [hovering, setHovering] = useState(false);
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={() => (isFollowing ? onUnfollowRequest() : onFollow())}
      className={
        isFollowing
          ? "rounded-full border border-slate-200 bg-slate-100 px-4 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          : "rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
      }
    >
      {isFollowing ? (hovering ? "Dejar de seguir" : "Siguiendo") : "Seguir"}
    </button>
  );
}
