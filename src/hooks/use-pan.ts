// ▶ Movimiento libre de superficies (lienzo del nivel y tablero de escenas).
//
// Permite arrastrar el contenido a cualquier posición con el ratón, el dedo,
// la rueda o el botón central del ratón. Un arrastre que supera el umbral no
// dispara el clic de lo que hubiera debajo, así que tocar sigue siendo tocar.
//
// Uso: el consumidor guarda la superficie en un estado y la pasa al hook
//   const [el, setEl] = useState<HTMLDivElement | null>(null);
//   const pan = usePan({ element: el, enabled: tool === "move" });
//   <div ref={setEl} style={pan.interaction} {...pan.viewportProps} />
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

export interface PanOffset {
  x: number;
  y: number;
}

/** Límites de movimiento: fuera de ellos no se puede dejar el contenido. */
export interface PanLimits {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface UsePanOptions {
  /** Superficie que se mueve (para la rueda del ratón). */
  element: HTMLDivElement | null;
  /**
   * Modo "mano": el botón principal arrastra la superficie aunque el puntero
   * esté encima de otro elemento (en el editor, la rejilla del nivel).
   */
  enabled?: boolean;
  /** Posición inicial respecto al origen de la superficie. */
  initial?: PanOffset;
  /**
   * Límites calculados al vuelo (p. ej. para que el contenido nunca salga del
   * todo de la vista). Devolver `null` deja mover sin límite.
   */
  limits?: () => PanLimits | null;
}

/** Arrastre en curso: desde dónde empezó y dónde estaba el contenido. */
interface Drag {
  id: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

/** Movimiento mínimo (px) para considerar que el gesto es un arrastre. */
const DRAG_THRESHOLD = 5;
/** Tiempo durante el que se descarta el clic con el que termina un arrastre. */
const CLICK_GUARD_MS = 300;
/** Campos de texto: ahí el gesto pertenece al cursor, no a la superficie. */
const NO_DRAG = 'a, input, textarea, select, [contenteditable="true"]';

/** Deja la posición dentro de los límites indicados (si los hay). */
function clampToLimits(next: PanOffset, getLimits?: () => PanLimits | null): PanOffset {
  const limits = getLimits?.();
  if (!limits) return next;
  return {
    x: Math.min(limits.maxX, Math.max(limits.minX, next.x)),
    y: Math.min(limits.maxY, Math.max(limits.minY, next.y)),
  };
}

export function usePan({
  element,
  enabled = false,
  initial = { x: 0, y: 0 },
  limits,
}: UsePanOptions) {
  const { x: initialX, y: initialY } = initial;
  const [offset, setOffset] = useState<PanOffset>({ x: initialX, y: initialY });
  const [drag, setDrag] = useState<Drag | null>(null);
  const panning = drag !== null;

  // Se lee en cada gesto, así siempre se usan los límites más recientes.
  const limitsRef = useRef(limits);
  useEffect(() => {
    limitsRef.current = limits;
  });

  // Posición real (con decimales) y fotograma pendiente. El estado que se pinta
  // se actualiza como MUCHO una vez por fotograma: la rueda del ratón y el
  // arrastre pueden disparar decenas de eventos por segundo y no hace falta
  // volver a dibujar la superficie en cada uno.
  const realOffset = useRef<PanOffset>({ x: initialX, y: initialY });
  const frame = useRef<number | null>(null);

  const apply = useCallback((next: PanOffset) => {
    realOffset.current = clampToLimits(next, limitsRef.current);
    if (frame.current !== null) return;
    frame.current = window.requestAnimationFrame(() => {
      frame.current = null;
      const { x, y } = realOffset.current;
      // Píxeles enteros: el contenido se ve nítido y el navegador repinta menos.
      setOffset({ x: Math.round(x), y: Math.round(y) });
    });
  }, []);

  useEffect(
    () => () => {
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    },
    [],
  );

  const reset = useCallback(() => {
    if (frame.current !== null) {
      window.cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    realOffset.current = { x: initialX, y: initialY };
    setOffset({ x: initialX, y: initialY });
  }, [initialX, initialY]);

  // Rueda del ratón / trackpad: desplaza la superficie en cualquier dirección.
  // El listener es nativo porque React registra "wheel" como pasivo y entonces
  // no se podría cancelar el desplazamiento de la página.
  useEffect(() => {
    if (!element) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // deja pasar el zoom del navegador
      e.preventDefault();
      apply({ x: realOffset.current.x - e.deltaX, y: realOffset.current.y - e.deltaY });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [element, apply]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (panning) return;
      const middle = e.button === 1;
      const primary = e.button === 0;
      if (!middle && !primary) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest(NO_DRAG)) return;
      const onBackground = e.target === e.currentTarget;
      if (!middle && !enabled && !onBackground && !e.altKey) return;

      // Con el botón central evitamos el autoscroll del navegador. En el resto
      // de casos no llamamos a preventDefault: en táctil cancelaría el toque
      // que abre la escena o pulsa un botón.
      if (middle) e.preventDefault();

      setDrag({
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originX: realOffset.current.x,
        originY: realOffset.current.y,
      });
    },
    [enabled, panning],
  );

  // Mientras hay un arrastre escuchamos en la ventana, así el contenido sigue
  // al puntero aunque salga de la superficie.
  useEffect(() => {
    if (!drag) return;
    let moved = false;

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== drag.id) return;
      const dx = ev.clientX - drag.startX;
      const dy = ev.clientY - drag.startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) moved = true;
      if (!moved) return;
      apply({ x: drag.originX + dx, y: drag.originY + dy });
    };

    const stop = () => {
      setDrag(null);
      if (!moved) return;
      // El arrastre no debe acabar en un clic sobre la escena o la casilla.
      const swallow = (ev: MouseEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      document.addEventListener("click", swallow, true);
      window.setTimeout(
        () => document.removeEventListener("click", swallow, true),
        CLICK_GUARD_MS,
      );
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [drag, apply]);

  const interaction: CSSProperties = {
    touchAction: "none",
    cursor: panning ? "grabbing" : enabled ? "grab" : undefined,
  };

  return {
    /** Desplazamiento actual del contenido respecto a su origen. */
    offset,
    panning,
    /** true cuando el contenido está en su posición original. */
    isCentered: offset.x === initialX && offset.y === initialY,
    /** Devuelve el contenido a su posición original. */
    reset,
    /** Estilos de la superficie (touch-action + cursor). */
    interaction,
    /** Gestos que hay que conectar a la superficie. */
    viewportProps: { onPointerDown },
  };
}
