"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  formatter?: (value: number) => string;
  className?: string;
}

/**
 * Animated number counter that counts from 0 to target value on first mount.
 * Subsequent value changes show the final value immediately (no re-animation).
 * Uses requestAnimationFrame for smooth 60fps animation.
 */
export function AnimatedCounter({
  value,
  duration = 1200,
  formatter,
  className,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const startTime = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);
  const prevValue = useRef(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    // After first mount animation, skip animation for subsequent value changes
    if (hasAnimated.current) {
      setDisplayValue(value);
      prevValue.current = value;
      return;
    }

    const startValue = prevValue.current;
    const endValue = value;
    prevValue.current = value;

    if (startValue === endValue) {
      setDisplayValue(endValue);
      hasAnimated.current = true;
      return;
    }

    const animate = (timestamp: number) => {
      if (startTime.current === null) {
        startTime.current = timestamp;
      }

      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (endValue - startValue) * eased;

      setDisplayValue(Math.round(current));

      if (progress < 1) {
        rafId.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        hasAnimated.current = true;
      }
    };

    startTime.current = null;
    rafId.current = requestAnimationFrame(animate);

    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [value, duration]);

  const formattedValue = formatter ? formatter(displayValue) : displayValue.toString();

  return (
    <span className={className}>
      {formattedValue}
    </span>
  );
}

/**
 * Animated currency counter with THB formatting
 */
export function AnimatedCurrencyCounter({
  value,
  duration = 1200,
  className,
}: Omit<AnimatedCounterProps, "formatter">) {
  return (
    <AnimatedCounter
      value={value}
      duration={duration}
      className={className}
      formatter={(v) =>
        v.toLocaleString("th-TH", {
          style: "currency",
          currency: "THB",
          maximumFractionDigits: 0,
        })
      }
    />
  );
}
