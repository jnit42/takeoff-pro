/**
 * Learning Loop Hook
 * Logs user events and provides learning suggestions
 * All suggestions require user confirmation - no silent changes
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

type EventType = 
  | 'takeoff_item_promoted'
  | 'measurement_linked'
  | 'price_book_applied'
  | 'export_pdf'
  | 'assembly_selected'
  | 'labor_estimate_confirmed'
  | 'draft_generated'
  | 'project_created'
  | 'price_suggestion_accepted'
  | 'price_suggestion_rejected';

interface EventPayload {
  [key: string]: unknown;
}

export function useLearning() {
  const { user } = useAuth();

  /**
   * Log a user event for learning
   */
  const logEvent = useCallback(async (
    eventType: EventType,
    payload: EventPayload = {},
    projectId?: string
  ) => {
    if (!user?.id) return;

    try {
      // Check if learning is enabled
      const { data: settings } = await supabase
        .from('user_learning_settings')
        .select('learning_enabled')
        .eq('user_id', user.id)
        .single();

      // Default to enabled if no settings exist
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const learningEnabled = (settings as any)?.learning_enabled !== false;

      if (!learningEnabled) return;

      await supabase
        .from('user_events')
        .insert({
          user_id: user.id,
          project_id: projectId || null,
          event_type: eventType,
          payload,
        } as never);

      console.log(`[Learning] Event logged: ${eventType}`);
    } catch (error) {
      // Silent fail - learning is non-critical
      console.error('[Learning] Failed to log event:', error);
    }
  }, [user?.id]);

  /**
   * Save labor rate calibration after user confirms a labor estimate
   */
  const calibrateLaborRate = useCallback(async (
    trade: string,
    taskKey: string,
    unit: string,
    baseRate: number,
    modifiers?: Record<string, unknown>
  ) => {
    if (!user?.id) return;

    try {
      const { data: existing } = await supabase
        .from('labor_rate_calibration')
        .select('id, sample_count')
        .eq('user_id', user.id)
        .eq('trade', trade)
        .eq('task_key', taskKey)
        .single();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingRow = existing as any;

      if (existingRow) {
        // Update existing calibration
        await supabase
          .from('labor_rate_calibration')
          .update({
            base_rate: baseRate,
            unit,
            modifiers_json: modifiers || {},
            last_used_at: new Date().toISOString(),
            sample_count: (existingRow.sample_count || 0) + 1,
          } as never)
          .eq('id', existingRow.id);
      } else {
        // Create new calibration
        await supabase
          .from('labor_rate_calibration')
          .insert({
            user_id: user.id,
            trade,
            task_key: taskKey,
            unit,
            base_rate: baseRate,
            modifiers_json: modifiers || {},
          } as never);
      }

      console.log(`[Learning] Labor rate calibrated: ${trade}/${taskKey} @ ${baseRate}/${unit}`);
    } catch (error) {
      console.error('[Learning] Failed to calibrate labor rate:', error);
    }
  }, [user?.id]);

  /**
   * Get suggested labor rate from calibration history
   */
  const getSuggestedLaborRate = useCallback(async (
    trade: string,
    taskKey: string
  ): Promise<{ baseRate: number; unit: string; sampleCount: number } | null> => {
    if (!user?.id) return null;

    try {
      const { data } = await supabase
        .from('labor_rate_calibration')
        .select('base_rate, unit, sample_count')
        .eq('user_id', user.id)
        .eq('trade', trade)
        .eq('task_key', taskKey)
        .single();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = data as any;
      if (row) {
        return {
          baseRate: row.base_rate,
          unit: row.unit,
          sampleCount: row.sample_count,
        };
      }
      return null;
    } catch {
      return null;
    }
  }, [user?.id]);

  /**
   * Save assembly preset after user selects assemblies
   */
  const saveAssemblyPreset = useCallback(async (
    projectType: string,
    assemblyIds: string[]
  ) => {
    if (!user?.id || assemblyIds.length === 0) return;

    try {
      const { data: existing } = await supabase
        .from('assembly_presets')
        .select('id, times_used')
        .eq('user_id', user.id)
        .eq('project_type', projectType)
        .single();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingRow = existing as any;

      if (existingRow) {
        await supabase
          .from('assembly_presets')
          .update({
            assemblies: assemblyIds,
            last_used_at: new Date().toISOString(),
            times_used: (existingRow.times_used || 0) + 1,
          } as never)
          .eq('id', existingRow.id);
      } else {
        await supabase
          .from('assembly_presets')
          .insert({
            user_id: user.id,
            project_type: projectType,
            assemblies: assemblyIds,
          } as never);
      }

      console.log(`[Learning] Assembly preset saved for ${projectType}: ${assemblyIds.length} assemblies`);
    } catch (error) {
      console.error('[Learning] Failed to save assembly preset:', error);
    }
  }, [user?.id]);

  /**
   * Get suggested assemblies for a project type
   */
  const getSuggestedAssemblies = useCallback(async (
    projectType: string
  ): Promise<{ assemblyIds: string[]; timesUsed: number } | null> => {
    if (!user?.id) return null;

    try {
      const { data } = await supabase
        .from('assembly_presets')
        .select('assemblies, times_used')
        .eq('user_id', user.id)
        .eq('project_type', projectType)
        .single();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = data as any;
      if (row) {
        return {
          assemblyIds: row.assemblies || [],
          timesUsed: row.times_used || 0,
        };
      }
      return null;
    } catch {
      return null;
    }
  }, [user?.id]);

  /**
   * Get learning stats for settings display
   */
  const getLearningStats = useCallback(async () => {
    if (!user?.id) return null;

    try {
      const [laborCount, assemblyCount, eventCount] = await Promise.all([
        supabase
          .from('labor_rate_calibration')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('assembly_presets')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('user_events')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
      ]);

      return {
        laborCalibrations: laborCount.count || 0,
        assemblyPresets: assemblyCount.count || 0,
        totalEvents: eventCount.count || 0,
      };
    } catch {
      return null;
    }
  }, [user?.id]);

  /**
   * Clear all learning data
   */
  const clearLearningData = useCallback(async () => {
    if (!user?.id) return false;

    try {
      await Promise.all([
        supabase.from('labor_rate_calibration').delete().eq('user_id', user.id),
        supabase.from('assembly_presets').delete().eq('user_id', user.id),
        supabase.from('user_events').delete().eq('user_id', user.id),
      ]);

      console.log('[Learning] All learning data cleared');
      return true;
    } catch (error) {
      console.error('[Learning] Failed to clear learning data:', error);
      return false;
    }
  }, [user?.id]);

  /**
   * Toggle learning enabled/disabled
   */
  const setLearningEnabled = useCallback(async (enabled: boolean) => {
    if (!user?.id) return false;

    try {
      const { data: existing } = await supabase
        .from('user_learning_settings')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (existing) {
        await supabase
          .from('user_learning_settings')
          .update({ 
            learning_enabled: enabled,
            updated_at: new Date().toISOString()
          } as never)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('user_learning_settings')
          .insert({
            user_id: user.id,
            learning_enabled: enabled,
          } as never);
      }

      return true;
    } catch (error) {
      console.error('[Learning] Failed to update settings:', error);
      return false;
    }
  }, [user?.id]);

  /**
   * Check if learning is enabled
   */
  const isLearningEnabled = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return true;

    try {
      const { data } = await supabase
        .from('user_learning_settings')
        .select('learning_enabled')
        .eq('user_id', user.id)
        .single();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data as any)?.learning_enabled !== false;
    } catch {
      return true; // Default to enabled
    }
  }, [user?.id]);

  return {
    logEvent,
    calibrateLaborRate,
    getSuggestedLaborRate,
    saveAssemblyPreset,
    getSuggestedAssemblies,
    getLearningStats,
    clearLearningData,
    setLearningEnabled,
    isLearningEnabled,
  };
}
