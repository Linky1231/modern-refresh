// ─────────────────────────────────────────────────────────────────────
// PARTE 3 · ENCUESTAS: visualización + votación dentro de la publicación.
// ─────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import { BarChart3, Check } from "lucide-react";
import { getMyPollVote, voteOnPoll } from "@/lib/db";

export interface PollViewData {
  id: string;
  question: string;
  options: Array<{ id: string; text: string }>;
  votes: Record<string, number>;
}

interface PostPollProps {
  poll: PollViewData;
  userId?: string | null;
}

export function PostPoll({ poll, userId }: PostPollProps) {
  const [votedOptionId, setVotedOptionId] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, number>>(poll.votes || {});
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    let active = true;
    setVotes(poll.votes || {});
    if (userId && poll.id) {
      getMyPollVote(userId, poll.id)
        .then((optionId) => {
          if (active && optionId) setVotedOptionId(optionId);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [poll.id, poll.votes, userId]);

  const totalVotes = poll.options.reduce((sum, o) => sum + (votes[o.id] || 0), 0);
  const hasVoted = !!votedOptionId || !userId;

  const handleVote = useCallback(
    async (optionId: string) => {
      if (!userId || voting || votedOptionId) return;
      setVoting(true);
      try {
        const result = await voteOnPoll(userId, poll.id, optionId);
        setVotedOptionId(result.optionId);
        setVotes(result.counts);
      } catch (error) {
        console.error("Error al votar:", error);
      } finally {
        setVoting(false);
      }
    },
    [userId, voting, votedOptionId, poll.id],
  );

  const pct = (optionId: string) =>
    totalVotes === 0 ? 0 : Math.round(((votes[optionId] || 0) / totalVotes) * 100);

  return (
    <div className="rounded-2xl border border-border/40 bg-card px-4 py-3.5 sm:px-5">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5">
        <BarChart3 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-sm font-semibold text-card-foreground min-w-0">
          {poll.question || "Encuesta"}
        </p>
      </div>

      {/* ── Options ────────────────────────────────────────── */}
      <div className="mt-3 flex flex-col gap-2">
        {poll.options.map((option) => {
          const p = pct(option.id);
          const selected = votedOptionId === option.id;
          return hasVoted ? (
            <div
              key={option.id}
              className="relative overflow-hidden rounded-xl border border-border/24 bg-background px-3 py-2.5"
            >
              <div
                className="absolute inset-y-0 left-0 rounded-l-xl bg-muted transition-all duration-500 ease-out"
                style={{ width: `${Math.max(p, 2)}%` }}
              />
              <div className="relative flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-card-foreground">
                  {selected && (
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                  )}
                  <span className="truncate">{option.text}</span>
                </span>
                <span className="shrink-0 text-xs font-bold tabular-nums text-card-foreground">
                  {p}%
                </span>
              </div>
            </div>
          ) : (
            <button
              key={option.id}
              type="button"
              disabled={voting}
              onClick={() => handleVote(option.id)}
              className="poll-vote-btn flex items-center justify-between gap-2 rounded-xl border border-border/30 bg-background px-3 py-2.5 text-left text-[13px] font-medium text-card-foreground disabled:opacity-60"
            >
              <span className="truncate">{option.text}</span>
              <span className="shrink-0 rounded-lg border border-border/45 px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                Votar
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div className="mt-2.5 flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground/50 tabular-nums">
          {totalVotes} {totalVotes === 1 ? "voto" : "votos"}
        </p>
        <p className="text-[11px] text-muted-foreground/50">
          respuestas anónimas
        </p>
      </div>
    </div>
  );
}
