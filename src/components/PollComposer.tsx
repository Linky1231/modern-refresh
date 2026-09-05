// ─────────────────────────────────────────────────────────────────────
// PARTE 2 · ENCUESTAS: editor de la encuesta dentro del compositor.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { BarChart3, Plus, Trash2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface PollDraft {
  question: string;
  options: string[];
}

interface PollComposerProps {
  onChange: (draft: PollDraft | null) => void;
  onRemove: () => void;
}

const MAX_OPTIONS = 5;
const MIN_OPTIONS = 2;
const MAX_QUESTION = 200;
const MAX_OPTION_TEXT = 100;

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
  const lastSent = useRef<PollDraft | null>(null);
  const questionRef = useRef<HTMLInputElement>(null);

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
      className="rounded-2xl border border-border/30 bg-card px-4 py-4 sm:px-5"
    >
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <BarChart3 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-semibold text-card-foreground">
            Encuesta
          </span>
          {/* Toggle switch — clearly interactive */}
          <label className="flex cursor-pointer items-center gap-1.5 select-none">
            <span className="relative inline-flex h-5 w-8 shrink-0 items-center rounded-full bg-muted transition-colors">
              <span className="pointer-events-none inline-block h-3.5 w-3.5 translate-x-[3px] rounded-full bg-card shadow-sm ring-0 transition-transform" />
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              Anónima
            </span>
          </label>
        </div>
        <button
          type="button"
          onClick={onRemove}
          title="Quitar encuesta"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Pregunta ────────────────────────────────────────── */}
      <div className="mt-3">
        <input
          ref={questionRef}
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={MAX_QUESTION}
          placeholder="Escribe tu pregunta…"
          className="w-full rounded-xl border border-border/35 bg-background px-3.5 py-2.5 text-sm text-card-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
        />
      </div>

      {/* ── Opciones ────────────────────────────────────────── */}
      <div className="mt-3 flex flex-col gap-2">
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
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground tabular-nums">
                {i + 1}
              </span>
              <input
                type="text"
                value={opt}
                onChange={(e) => setOption(i, e.target.value)}
                maxLength={MAX_OPTION_TEXT}
                placeholder={`Opción ${i + 1}`}
                className="h-9 flex-1 rounded-xl border border-border/35 bg-background px-3.5 text-sm text-card-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
              {options.length > MIN_OPTIONS && (
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  title="Quitar opción"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div className="mt-3 border-t border-border/24 pt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={addOption}
          disabled={options.length >= MAX_OPTIONS}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Añadir opción</span>
          <span className="tabular-nums">({options.length}/{MAX_OPTIONS})</span>
        </button>
        {/* Validation hint — only shows when question is filled but not enough options */}
        {question.trim().length > 0 && uniqueOptions.length < MIN_OPTIONS && (
          <p className="text-[10px] text-muted-foreground/70">
            Añade al menos {MIN_OPTIONS} opciones
          </p>
        )}
      </div>
    </motion.div>
  );
}
