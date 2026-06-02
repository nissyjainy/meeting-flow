import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { createClient } from "@/lib/supabase/client";
import { validateClientStartupEnv } from "@/lib/startup-env-validation";
import { applyThemeToDocument, readStoredTheme } from "@/lib/theme";
import { useAppStore } from "@/store/app-store";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    validateClientStartupEnv("auth-provider");
    const theme = readStoredTheme();
    applyThemeToDocument(theme);
    useAppStore.setState({ theme });
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event) => {
      router.invalidate();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return children;
}
