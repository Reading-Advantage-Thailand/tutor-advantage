"use client";

import { useEffect, useRef } from "react";

const GIVE_UP_AFTER_MS = 30_000;

type GameAssetLoadFailureProps = {
  onRetry: () => void;
  /**
   * In a live lesson the class waits for every student's result, so a phone
   * that cannot load the game submits 0 instead of holding everyone up.
   * Leave it out where nobody is waiting (tutor demo).
   */
  onGiveUp?: () => void;
};

export function GameAssetLoadFailure({ onRetry, onGiveUp }: GameAssetLoadFailureProps) {
  const onGiveUpRef = useRef(onGiveUp);
  useEffect(() => {
    onGiveUpRef.current = onGiveUp;
  }, [onGiveUp]);
  const canGiveUp = Boolean(onGiveUp);
  const onRetryRef = useRef(onRetry);
  useEffect(() => {
    onRetryRef.current = onRetry;
  }, [onRetry]);

  // The usual cause is a short network drop, so try again as soon as it is back.
  useEffect(() => {
    const retry = () => onRetryRef.current();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);

  useEffect(() => {
    if (!canGiveUp) return;
    const timer = setTimeout(() => onGiveUpRef.current?.(), GIVE_UP_AFTER_MS);
    return () => clearTimeout(timer);
  }, [canGiveUp]);

  return (
    <div
      role="alert"
      data-testid="game-asset-load-failure"
      className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center text-white"
    >
      <p className="text-lg font-black">โหลดเกมไม่สำเร็จ</p>
      <p className="max-w-xs text-sm font-semibold text-white/70">
        การเชื่อมต่ออาจช้าหรือหลุด ลองโหลดอีกครั้ง
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 min-h-11 rounded-2xl bg-emerald-500 px-6 text-base font-black text-white active:scale-95"
      >
        ลองใหม่
      </button>
      {canGiveUp && (
        <>
          <button
            type="button"
            onClick={() => onGiveUpRef.current?.()}
            className="min-h-11 rounded-2xl px-6 text-sm font-bold text-white/70 underline"
          >
            ข้ามเกมนี้
          </button>
          <p className="max-w-xs text-xs text-white/50">
            ถ้ายังโหลดไม่ได้ ระบบจะส่งผลเป็น 0 ให้ใน 30 วินาที เพื่อให้เพื่อนในห้องเรียนต่อได้
          </p>
        </>
      )}
    </div>
  );
}

/** Spinner shown while a game's images download. */
export function GameAssetLoading() {
  return (
    <div
      role="status"
      data-testid="game-asset-loading"
      className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-slate-950/80 text-center"
    >
      <div className="size-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
      <p className="text-sm font-semibold text-white/80">กำลังโหลดเกม...</p>
    </div>
  );
}
