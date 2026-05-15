import { create } from "zustand";
import { BookingDraft } from "./types";

type BookingState = {
  draft: BookingDraft;
  loading: boolean;
  setDraft: (data: Partial<BookingDraft>) => void;
  resetDraft: () => void;
};

export const useBookingStore = create<BookingState>((set) => ({
  draft: {},
  loading: false,
  setDraft: (data) =>
    set((state) => ({
      draft: { ...state.draft, ...data },
    })),
  resetDraft: () => set({ draft: {} }),
}));
