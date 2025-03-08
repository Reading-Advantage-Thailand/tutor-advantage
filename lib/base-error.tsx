import { create } from "zustand";

interface ErrorState {
  error: Error | null;
  showError: (error: Error) => void;
  resetError: () => void;
}

export const useErrorStore = create<ErrorState>((set) => ({
  error: null,
  showError: (error) => set({ error }),
  resetError: () => set({ error: null }),
}));

export const baseError = {
  global: (message: string) => {
    useErrorStore.getState().showError(new Error(message));
  },
};
