// ─────────────────────────────────────────────────────────────────────
// PARTE 2 · ENCUESTAS: editor de la encuesta dentro del compositor.
// Layout ordenado en 3 bloques con aire entre ellos:
//   1) Encabezado (título + cerrar)
//   2) Pregunta
//   3) Opciones (+ añadir)
//   4) Duración
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { BarChart3, Plus, Trash2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";

export interface PollDraft {
  question: string;
  options: string[];
}

interface PollComposerProps {
  onChange: (draft: PollDraft | null) => void;
  onRemove: () => void;
}

type DurationOption = "24 hrs" | "3 días" | "7 días";

const MAX_OPTIONS = 5;
const MIN_OPTIONS = 2;
const MAX_QUESTION = 200;
const MAX_OPTION_TEXT = 100;
const DURATIONS: DurationOption[] = ["24 hrs", "3 días", "7 días"];

function draftsEqual(a: PollDraft | null, b: PollDraft | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.question !== b.question) return false;
  if (a.options.length !== b.options.length) return false;
  return a.options.every((opt, i) => opt === b.options[i]);
}

export default function PollComposer({ onChange, onRemove }: PollComposerProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [duration, setDuration] = useState<DurationOption>("24 hrs");
  const lastSent = useRef<PollDraft | null>(null);

  const uniqueOptions = options
    .map((o) => o.trim())
    .filter((o, i, arr) => o && arr.indexOf(o) === i);

  const isValid =
    question.trim().length > 0 && uniqueOptions.length >= MIN_OPTIONS;

  useEffect(() => {
    const next: PollDraft | null = isValid
      ? { question: question.trim(), options: uniqueOptions }
      : null;
    if (draftsEqual(lastSent.current, next)) return;
    lastSent.current = next;
    onChange(next);
  }, [isValid, onChange, question, uniqueOptions]);

  const setOption = (index: number, value: string) => {
    setOptions((prev) => prev.map((opt, i) => (i === index ? value : opt)));
  };

  const addOption = () => {
    setOptions((prev) => (prev.length < MAX_OPTIONS ? [...prev, ""] : prev));
  };

  const removeOption = (index: number) => {
    setOptions((prev) =>
      prev.length > MIN_OPTIONS ? prev.filter((_, i) => i !== index) : prev,
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
      className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5 shadow-sm"
    >
      {/* ── Encabezado ──────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 pb-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BarChart3 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-card-foreground">Encuesta</p>
            <p className="truncate text-[11px] text-muted-foreground">
              Hazle una pregunta a la comunidad
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          title="Quitar encuesta"
          aria-label="Quitar encuesta"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-slate-200/70 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Pregunta ────────────────────────────────────────── */}
      <div className="mt-3.5">
        <label
          htmlFor="poll-question"
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Pregunta
        </label>
        <Input
          id="poll-question"
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={MAX_QUESTION}
          placeholder="Escribe tu pregunta…"
          className="h-10 rounded-xl border-slate-200 bg-white text-sm text-foreground placeholder:text-slate-400"
        />
      </div>

      {/* ── Opciones ────────────────────────────────────────── */}
      <div className="mt-3.5">
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Opciones
          </label>
          <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
            {options.length}/{MAX_OPTIONS}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {options.map((opt, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                className="flex items-center gap-2.5"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-[11px] font-semibold text-slate-500 tabular-nums">
                  {i + 1}
                </span>
                <Input
                  type="text"
                  value={opt}
                  onChange={(e) => setOption(i, e.target.value)}
                  maxLength={MAX_OPTION_TEXT}
                  placeholder={`Opción ${i + 1}`}
                  className="h-10 flex-1 rounded-xl border-slate-200 bg-white text-sm text-foreground placeholder:text-slate-400"
                />
                {options.length > MIN_OPTIONS && (
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    title="Quitar opción"
                    aria-label={`Quitar opción ${i + 1}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={addOption}
          disabled={options.length >= MAX_OPTIONS}
          className="mt-2.5 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-white/60 text-xs font-semibold text-primary transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:pointer-events-none disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          Añadir opción
        </button>

        {question.trim().length > 0 && uniqueOptions.length < MIN_OPTIONS && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Añade al menos {MIN_OPTIONS} opciones para publicar la encuesta.
          </p>
        )}
      </div>

      {/* ── Duración ────────────────────────────────────────── */}
      <div className="mt-3.5 border-t border-slate-200/70 pt-3.5">
        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Duración
        </label>
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDuration(d)}
              aria-pressed={duration === d}
              className={`h-8 flex-1 rounded-lg text-xs font-medium transition-colors ${
                duration === d
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
