import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";

/**
 * Hook to log user activity (app opens, page visits) for statistics
 * Call this in the main app component or layout to track all users
 */
export function useActivityTracking() {
  const { userId } = useCurrentUser();

  useEffect(() => {
    if (!userId) return;

    let isTracked = false;

    async function logAppOpen() {
      try {
        if (!isTracked) {
          await supabase.rpc("log_user_activity", {
            _activity_type: "app_open",
            _page_name: window.location.pathname,
          });
          isTracked = true;
        }
      } catch (err) {
        console.error("Failed to log app open:", err);
      }
    }

    // Log app open when component mounts
    void logAppOpen();

    // Track page changes
    const handleRouteChange = () => {
      try {
        void supabase.rpc("log_user_activity", {
          _activity_type: "page_visit",
          _page_name: window.location.pathname,
        });
      } catch (err) {
        console.error("Failed to log page visit:", err);
      }
    };

    // Listen to route changes (works with SPA routers)
    window.addEventListener("popstate", handleRouteChange);

    return () => {
      window.removeEventListener("popstate", handleRouteChange);
    };
  }, [userId]);
}
