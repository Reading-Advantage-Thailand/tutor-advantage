import type { PerformanceScore } from '@/types/adaptive-difficulty';

export interface AdjustmentConfig {
  alpha: number; // EMA smoothing factor (0-1)
  increaseThreshold: number;
  decreaseThreshold: number;
  maxChangePercent: number;
  cycleSize: number;
}

export interface AdjustmentResult {
  direction: 'increase' | 'decrease' | 'hold';
  adjustedValue: number;
  delta: number;
  rawScore: number;
  emaScore: number;
}

const DEFAULT_CONFIG: AdjustmentConfig = {
  alpha: 0.3,
  increaseThreshold: 80,
  decreaseThreshold: 40,
  maxChangePercent: 0.15, // ±15%
  cycleSize: 5,
};

export class AdjustmentEngine {
  private config: AdjustmentConfig;
  private emaScore: number = 50; // Start at neutral
  private responseCount: number = 0;

  constructor(config: Partial<AdjustmentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  shouldAdjust(): boolean {
    return this.responseCount >= this.config.cycleSize;
  }

  adjustParameter(
    currentValue: number,
    min: number,
    max: number,
    performanceScore: PerformanceScore
  ): AdjustmentResult {
    this.responseCount++;

    // Update EMA
    this.emaScore =
      this.config.alpha * performanceScore.score +
      (1 - this.config.alpha) * this.emaScore;

    // Determine direction
    let direction: 'increase' | 'decrease' | 'hold';
    if (this.emaScore > this.config.increaseThreshold) {
      direction = 'increase';
    } else if (this.emaScore < this.config.decreaseThreshold) {
      direction = 'decrease';
    } else {
      direction = 'hold';
    }

    // Calculate adjustment
    const range = max - min;
    const maxChange = range * this.config.maxChangePercent;
    let delta = 0;

    if (direction === 'increase') {
      // Scale adjustment based on how far above threshold
      const excess = this.emaScore - this.config.increaseThreshold;
      const scale = Math.min(excess / 20, 1); // Max at 100 (20 points above threshold)
      delta = maxChange * scale;
    } else if (direction === 'decrease') {
      // Scale adjustment based on how far below threshold
      const deficit = this.config.decreaseThreshold - this.emaScore;
      const scale = Math.min(deficit / 40, 1); // Max at 0 (40 points below threshold)
      delta = -maxChange * scale;
    }

    // Apply adjustment
    let adjustedValue = currentValue + delta;

    // Clamp to bounds
    adjustedValue = Math.max(min, Math.min(max, adjustedValue));

    // Recalculate actual delta after clamping
    const actualDelta = adjustedValue - currentValue;

    return {
      direction,
      adjustedValue,
      delta: actualDelta,
      rawScore: performanceScore.score,
      emaScore: this.emaScore,
    };
  }

  reset(): void {
    this.emaScore = 50;
    this.responseCount = 0;
  }

  getEmaScore(): number {
    return this.emaScore;
  }

  getResponseCount(): number {
    return this.responseCount;
  }

  getConfig(): AdjustmentConfig {
    return { ...this.config };
  }
}
