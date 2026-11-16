"use client";

import { useMemo, useState } from "react";
import { diffRankMoves, rankMap, scoreSignature } from "./leaderboardModel";

interface Snapshot {
  signature: string;
  ranks: Map<string, number>;
  moves: Map<string, number>;
}

/**
 * Adds `rankMove` (+ up, − down) to each participant, derived on the phone
 * from the previous ranking it showed (presentation state only: the server
 * sends no previous rank). The moves change only when a score changes, so
 * ready/join updates do not clear the arrows.
 */
export function useRankMoves<T extends { studentId: string; score?: number }>(participants: T[]): Array<T & { rankMove?: number }> {
  const signature = scoreSignature(participants);
  const [snapshot, setSnapshot] = useState<Snapshot>(() => ({
    signature,
    ranks: rankMap(participants),
    moves: new Map(),
  }));

  // Derived state from props (React's "adjust state while rendering" pattern).
  let current = snapshot;
  if (signature !== snapshot.signature) {
    const ranks = rankMap(participants);
    current = { signature, ranks, moves: diffRankMoves(snapshot.ranks, ranks) };
    setSnapshot(current);
  }
  const moves = current.moves;

  return useMemo(
    () =>
      participants.map((participant) => {
        const move = moves.get(participant.studentId);
        return move ? { ...participant, rankMove: move } : participant;
      }),
    [participants, moves],
  );
}
