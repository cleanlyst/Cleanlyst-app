import { create } from "zustand";
import { supabase } from "@/services/supabase";

type User = {
  id: string;
  email: string;
  role?: string;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,

  init: async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (session?.user) {
      set({
        user: {
          id: session.user.id,
          email: session.user.email ?? "",
        },
      });
    }

    set({ initialized: true });

    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        set({
          user: {
            id: session.user.id,
            email: session.user.email ?? "",
          },
        });
      } else {
        set({ user: null });
      }
    });
  },

  signIn: async (email, password) => {
    set({ loading: true });
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    set({ loading: false });
    if (error) throw error;
  },

  signOut: async () => {
    set({ loading: true });
    await supabase.auth.signOut();
    set({ user: null, loading: false });
  },
}));
