export function getSupabasePublicConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ""
  };
}

export function getSupabaseServiceConfig() {
  return {
    ...getSupabasePublicConfig(),
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ""
  };
}

export function isSupabaseConfigured() {
  const config = getSupabasePublicConfig();
  return Boolean(config.url && config.anonKey);
}

export function isSupabaseAdminConfigured() {
  const config = getSupabaseServiceConfig();
  return Boolean(config.url && config.serviceRoleKey);
}

export function getOwnerEmail() {
  return process.env.STOCKRADAR_OWNER_EMAIL?.trim().toLowerCase() ?? "";
}
