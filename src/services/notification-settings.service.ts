import { supabase } from '@/lib/supabase';
import type { NotificationPreferences, ChildNotificationSettings } from '@/types';

export interface UpdateNotificationPreferencesInput {
  whatsapp_enabled?: boolean;
  daily_reminder?: boolean;
  reminder_time?: string;
  unfinished_warning_enabled?: boolean;
  unfinished_warning_time?: string;
  completed_notice_enabled?: boolean;
  completed_notice_time?: string;
  weekly_summary_enabled?: boolean;
  weekly_summary_weekday?: number;
  weekly_summary_time?: string;
  tabuada_medal_notice_enabled?: boolean;
  tabuada_weekly_summary_enabled?: boolean;
  tabuada_day_completed_enabled?: boolean;
}

export interface UpdateChildNotificationSettingsInput {
  whatsapp_enabled?: boolean;
  daily_reminder_enabled?: boolean;
  daily_reminder_time?: string;
  unfinished_warning_enabled?: boolean;
  unfinished_warning_time?: string;
  tabuada_reminder_enabled?: boolean;
  tabuada_reminder_hours?: number[];
  tabuada_weekly_summary_enabled?: boolean;
}

export const notificationSettingsService = {
  /** Devolve as definições do pai, criando a linha default se ainda não existir. */
  async getParentPreferences(parentId: string): Promise<NotificationPreferences> {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('parent_id', parentId)
      .maybeSingle();
    if (error) throw new Error('errors.generic');
    if (data) return data as NotificationPreferences;

    const { data: created, error: insertError } = await supabase
      .from('notification_preferences')
      .insert({ parent_id: parentId })
      .select()
      .single();
    if (insertError) throw new Error('errors.generic');
    return created as NotificationPreferences;
  },

  async updateParentPreferences(
    parentId: string,
    updates: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreferences> {
    const { data, error } = await supabase
      .from('notification_preferences')
      .update(updates)
      .eq('parent_id', parentId)
      .select()
      .single();
    if (error) throw new Error('errors.generic');
    return data as NotificationPreferences;
  },

  /** Devolve as definições da criança, criando a linha default se ainda não existir. */
  async getChildSettings(childId: string): Promise<ChildNotificationSettings> {
    const { data, error } = await supabase
      .from('child_notification_settings')
      .select('*')
      .eq('child_id', childId)
      .maybeSingle();
    if (error) throw new Error('errors.generic');
    if (data) return data as ChildNotificationSettings;

    const { data: created, error: insertError } = await supabase
      .from('child_notification_settings')
      .insert({ child_id: childId })
      .select()
      .single();
    if (insertError) throw new Error('errors.generic');
    return created as ChildNotificationSettings;
  },

  async updateChildSettings(
    childId: string,
    updates: UpdateChildNotificationSettingsInput,
  ): Promise<ChildNotificationSettings> {
    const { data, error } = await supabase
      .from('child_notification_settings')
      .update(updates)
      .eq('child_id', childId)
      .select()
      .single();
    if (error) throw new Error('errors.generic');
    return data as ChildNotificationSettings;
  },
};
