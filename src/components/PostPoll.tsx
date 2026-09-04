// ▶ [MIGRACIÓN LOVABLE CLOUD] Componente de encuestas de una
// publicación. Los votos se guardan en el dispositivo (anónimos:
// solo se cuentan, nunca se muestra quién votó qué).
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
    <div className="rounded-2xl border border-border/50 bg-background/40 px-4 py-3.5">
      <div className="flex items-start gap-2">
        <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-card-foreground">
            {poll.question || "Encuesta"}
          </p>

          <div className="mt-2.5 flex flex-col gap-2">
            {poll.options.map((option) => {
              const p = pct(option.id);
              const selected = votedOptionId === option.id;
              return hasVoted ? (
                <div key={option.id} className="relative overflow-hidden rounded-xl border border-border/40 bg-card px-3 py-2">
                  <div
                    className="absolute inset-y-0 left-0 bg-primary/10 transition-all duration-500"
                    style={{ width: `${p}%` }}
                  />
                  <div className="relative flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-card-foreground">
                      {selected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
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
                  className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-card px-3 py-2 text-left text-[13px] text-card-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60"
                >
                  <span className="truncate">{option.text}</span>
                  <span className="shrink-0 rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Votar
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-[11px] text-muted-foreground/70">
            {totalVotes} {totalVotes === 1 ? "voto" : "votos"} · respuestas anónimas
          </p>
        </div>
      </div>
    </div>
  );
}
