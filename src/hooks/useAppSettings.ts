import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UseAppSettingsReturn {
  electionsEnabled: boolean;
  loading: boolean;
  setElectionsEnabled: (enabled: boolean) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function useAppSettings(): UseAppSettingsReturn {
  const [electionsEnabled, setElectionsEnabledState] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'elections_enabled')
        .maybeSingle();

      if (!error && data) {
        const val = typeof data.value === 'boolean' ? data.value : data.value === 'true' || data.value === true;
        setElectionsEnabledState(Boolean(val));
      }
    } catch (err) {
      console.error('Error fetching app settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const setElectionsEnabled = async (enabled: boolean): Promise<boolean> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id || null;

      const { error } = await supabase
        .from('app_settings')
        .upsert(
          {
            key: 'elections_enabled',
            value: enabled as unknown as Record<string, unknown>,
            updated_at: new Date().toISOString(),
            updated_by: userId,
          },
          { onConflict: 'key' }
        );

      if (error) {
        console.error('Failed to update elections setting:', error);
        return false;
      }

      setElectionsEnabledState(enabled);
      return true;
    } catch (err) {
      console.error('Error setting app setting:', err);
      return false;
    }
  };

  useEffect(() => {
    void fetchSettings();

    // Subscribe to realtime changes on app_settings
    const channel = supabase
      .channel('app_settings_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings', filter: 'key=eq.elections_enabled' },
        (payload) => {
          if (payload.new && 'value' in payload.new) {
            const rawVal = payload.new.value;
            const val = typeof rawVal === 'boolean' ? rawVal : rawVal === 'true' || rawVal === true;
            setElectionsEnabledState(Boolean(val));
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return {
    electionsEnabled,
    loading,
    setElectionsEnabled,
    refetch: fetchSettings,
  };
}

export default useAppSettings;
