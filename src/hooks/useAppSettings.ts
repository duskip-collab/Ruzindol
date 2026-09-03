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

    // Unique channel topic name per hook instance to prevent duplicate channel collisions
    let channel: any = null;
    const topic = `app_settings_${Math.random().toString(36).substring(2, 9)}`;

    const setupRealtime = async () => {
      try {
        channel = supabase.channel(topic, {
          config: { broadcast: { ack: true } }
        });
        
        channel
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'app_settings', filter: 'key=eq.elections_enabled' },
            (payload) => {
              if (payload.new && 'value' in payload.new) {
                const rawVal = (payload.new as { value: unknown }).value;
                const val = typeof rawVal === 'boolean' ? rawVal : rawVal === 'true' || rawVal === true;
                setElectionsEnabledState(Boolean(val));
              }
            }
          );

        await channel.subscribe((status: string) => {
          if (status !== 'SUBSCRIBED' && status !== 'SUBSCRIBING') {
            console.warn('App settings realtime status:', status);
          }
        });
      } catch (err) {
        console.error('Error setting up app settings realtime:', err);
      }
    };

    void setupRealtime();

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
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
