export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type SupabaseProfileRow = {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
};

export type SupabaseHoldingRow = {
  id: string;
  user_id: string;
  symbol: string;
  company_name: string | null;
  quantity: number | string;
  average_cost: number | string;
  currency: string;
  account_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SupabaseWatchlistRow = {
  id: string;
  user_id: string;
  symbol: string;
  company_name: string | null;
  target_buy_price: number | string | null;
  target_sell_price: number | string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SupabaseUserSettingsRow = {
  id: string;
  user_id: string;
  settings: Json;
  created_at: string;
  updated_at: string;
};

export type SupabaseAlertRuleRow = {
  id: string;
  user_id: string;
  symbol: string;
  rule_type: string;
  operator: string | null;
  threshold: number | string | null;
  configuration: Json;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type SupabaseAlertEventRow = {
  id: string;
  user_id: string;
  alert_rule_id: string | null;
  symbol: string;
  event_type: string;
  message: string;
  market_price: number | string | null;
  market_data_source: string | null;
  market_data_updated_at: string | null;
  is_stale: boolean;
  triggered_at: string;
  acknowledged_at: string | null;
  metadata: Json;
};

export type SupabaseDailyReportRow = {
  id: string;
  user_id: string;
  report_date: string;
  report_content: Json;
  summary_text: string | null;
  created_at: string;
};

export type SupabaseMarketDataCacheRow = {
  symbol: string;
  data: Json;
  original_source: string | null;
  updated_at: string | null;
  cached_at: string;
  expires_at: string;
};

export type SupabaseEventCacheRow = {
  cache_key: string;
  data: Json;
  sources: Json;
  cached_at: string;
  expires_at: string;
};
