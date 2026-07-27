export enum MessageType {
  JOIN = 'join',
  LEAVE = 'leave',
  STATE_UPDATE = 'state_update',
  SCORE_SUBMIT = 'score_submit',
  ROUND_START = 'round_start',
  ROUND_END = 'round_end',
  GAME_OVER = 'game_over',
}

export interface PlayerState {
  id: string;
  name: string;
  score: number;
  wordsCollected: number;
  isConnected: boolean;
}

export interface GameState {
  status: 'waiting' | 'playing' | 'round_end' | 'game_over';
  currentRound: number;
  players: PlayerState[];
}

export interface VocabularyItem {
  term: string;
  translation: string;
}

export interface VocabularyPack {
  packId: string;
  items: VocabularyItem[];
}

export interface JoinMessage {
  type: MessageType.JOIN;
  payload: {
    roomCode: string;
    playerName: string;
    playerId: string;
  };
}

export interface LeaveMessage {
  type: MessageType.LEAVE;
  payload: {
    playerId: string;
    reason?: string;
  };
}

export interface StateUpdateMessage {
  type: MessageType.STATE_UPDATE;
  payload: {
    gameState: GameState;
    timestamp: number;
  };
}

export interface ScoreSubmitMessage {
  type: MessageType.SCORE_SUBMIT;
  payload: {
    playerId: string;
    score: number;
    wordsCollected: string[];
    timeTaken: number;
  };
}

export interface RoundStartMessage {
  type: MessageType.ROUND_START;
  payload: {
    roundNumber: number;
    totalRounds: number;
    vocabularyPack: VocabularyPack;
    timeLimit: number;
  };
}

export interface RoundEndMessage {
  type: MessageType.ROUND_END;
  payload: {
    roundNumber: number;
    rankings: Array<{
      playerId: string;
      score: number;
      position: number;
    }>;
  };
}

export interface GameOverMessage {
  type: MessageType.GAME_OVER;
  payload: {
    finalRankings: Array<{
      playerId: string;
      score: number;
      position: number;
      xpBonus: number;
    }>;
    totalRounds: number;
  };
}

export type MultiplayerMessage =
  | JoinMessage
  | LeaveMessage
  | StateUpdateMessage
  | ScoreSubmitMessage
  | RoundStartMessage
  | RoundEndMessage
  | GameOverMessage;

export function serializeMessage(message: MultiplayerMessage): string {
  return JSON.stringify(message);
}

export function deserializeMessage(data: string): MultiplayerMessage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    throw new Error('Invalid message: malformed JSON');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid message: not an object');
  }

  const obj = parsed as Record<string, unknown>;

  if (!obj.type || typeof obj.type !== 'string') {
    throw new Error('Invalid message: missing type');
  }

  const validTypes = Object.values(MessageType) as string[];
  if (!validTypes.includes(obj.type)) {
    throw new Error(`Unknown message type: ${obj.type}`);
  }

  return parsed as MultiplayerMessage;
}
