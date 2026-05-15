import { useEffect } from "react";
import { useAuthStore } from "@/features/auth/authStore";

export function useAuth() {
  const initialized = useAuthStore((state) => state.initialized);
  const user = useAuthStore((state) => state.user);
  const init = useAuthStore((state) => state.init);

  useEffect(() => {
    if (!initialized) {
      init().catch(console.error);
    }
  }, [initialized, init]);

  return { user, initialized };
}
