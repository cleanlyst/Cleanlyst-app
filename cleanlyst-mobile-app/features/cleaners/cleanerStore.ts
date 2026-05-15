import { create } from "zustand";
import type { Cleaner } from "@/types/cleaner";

type CleanerState = {
  query: string;
  results: Cleaner[];
  loading: boolean;
  setQuery: (value: string) => void;
  setResults: (items: Cleaner[]) => void;
  setLoading: (value: boolean) => void;
};

export const useCleanerStore = create<CleanerState>((set) => ({
  query: "",
  results: [],
  loading: false,
  setQuery: (value) => set({ query: value }),
  setResults: (items) => set({ results: items }),
  setLoading: (value) => set({ loading: value }),
}));
