import { useState, useCallback, useRef, useEffect } from 'react';
import { MessageType, type MultiplayerMessage, type GameState } from '@/types/multiplayer';

export interface UseMultiplayerGameStateOptions {
  playerId: string;
  onRoundStart?: (roundNumber: number, totalRounds: number, timeLimit: number) => void;
  onRoundEnd?: (rankings: Array<{ playerId: string; score: number; position: number }>) => void;
  onGameOver?: (finalRankings: Array<{ playerId: string; score: number; position: number; xpBonus: number }>) => void;
}

export interface UseMultiplayerGameStateReturn {
  gameState: GameState | null;
  isPlaying: boolean;
  currentRound: number;
  totalRounds: number;
  players: GameState['players'];
  submitWord: (word: string) => void;
  optimisticWords: string[];
  rejectedWords: string[];
  clearRejectedWords: () => void;
}

interface PendingSubmission {
  word: string;
  timestamp: number;
}

export function useMultiplayerGameState(
  sendMessage: (message: string) => void,
  onMessage: (event: string, handler: (data: unknown) => void) => (() => void),
  options: UseMultiplayerGameStateOptions
): UseMultiplayerGameStateReturn {
  const { playerId } = options;
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [optimisticWords, setOptimisticWords] = useState<string[]>([]);
  const [rejectedWords, setRejectedWords] = useState<string[]>([]);
  const pendingSubmissions = useRef<PendingSubmission[]>([]);

  const handleStateUpdate = useCallback((data: unknown) => {
    const message = data as { gameState: GameState; timestamp: number };
    if (message.gameState) {
      setGameState(message.gameState);

      // Check for rejected optimistic submissions
      const serverWords = message.gameState.players
        .find((p) => p.id === playerId)?.wordsCollected || 0;

      // Simple heuristic: if we have pending submissions and server state doesn't reflect them,
      // they were rejected
      const now = Date.now();
      const stillPending = pendingSubmissions.current.filter(
        (sub) => now - sub.timestamp < 2000 // 2 second grace period
      );

      if (stillPending.length > 0) {
        // Check if our optimistic words match server state
        const optimisticCount = optimisticWords.length;
        if (optimisticCount > serverWords) {
          // Some words were rejected
          const rejected = optimisticWords.slice(serverWords);
          setRejectedWords((prev) => [...prev, ...rejected]);
          setOptimisticWords((prev) => prev.slice(0, serverWords));
        }
      }

      pendingSubmissions.current = stillPending;
    }
  }, [playerId, optimisticWords]);

  const handleRoundStart = useCallback((data: unknown) => {
    const message = data as {
      roundNumber: number;
      totalRounds: number;
      timeLimit: number;
    };
    setOptimisticWords([]);
    setRejectedWords([]);
    pendingSubmissions.current = [];
    if (options.onRoundStart) {
      options.onRoundStart(message.roundNumber, message.totalRounds, message.timeLimit);
    }
  }, [options]);

  const handleRoundEnd = useCallback((data: unknown) => {
    const message = data as {
      roundNumber: number;
      rankings: Array<{ playerId: string; score: number; position: number }>;
    };
    if (options.onRoundEnd) {
      options.onRoundEnd(message.rankings);
    }
  }, [options]);

  const handleGameOver = useCallback((data: unknown) => {
    const message = data as {
      finalRankings: Array<{
        playerId: string;
        score: number;
        position: number;
        xpBonus: number;
      }>;
    };
    if (options.onGameOver) {
      options.onGameOver(message.finalRankings);
    }
  }, [options]);

  useEffect(() => {
    const unsubscribeState = onMessage('message', (data: unknown) => {
      try {
        const message = JSON.parse(data as string) as MultiplayerMessage;
        switch (message.type) {
          case MessageType.STATE_UPDATE:
            handleStateUpdate(message.payload);
            break;
          case MessageType.ROUND_START:
            handleRoundStart(message.payload);
            break;
          case MessageType.ROUND_END:
            handleRoundEnd(message.payload);
            break;
          case MessageType.GAME_OVER:
            handleGameOver(message.payload);
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    });

    return () => {
      unsubscribeState();
    };
  }, [onMessage, handleStateUpdate, handleRoundStart, handleRoundEnd, handleGameOver]);

  const submitWord = useCallback(
    (word: string) => {
      // Optimistically add word locally
      setOptimisticWords((prev) => [...prev, word]);
      pendingSubmissions.current.push({ word, timestamp: Date.now() });

      // Send to server
      const message = JSON.stringify({
        type: 'submit_word',
        payload: {
          playerId,
          word,
          timestamp: Date.now(),
        },
      });
      sendMessage(message);
    },
    [playerId, sendMessage]
  );

  const clearRejectedWords = useCallback(() => {
    setRejectedWords([]);
  }, []);

  return {
    gameState,
    isPlaying: gameState?.status === 'playing',
    currentRound: gameState?.currentRound ?? 0,
    totalRounds: 3, // Default, will be updated from round_start messages
    players: gameState?.players ?? [],
    submitWord,
    optimisticWords,
    rejectedWords,
    clearRejectedWords,
  };
}
