export type AppSettings = {
  defaultCurrency: "CAD" | "USD";
  defaultLanguage: "zh-CN" | "en-US";
  riskPreference: "保守" | "平衡" | "激进";
  aiScoreThreshold: number;
  alertThreshold: number;
  defaultAccountId: string;
};

export const defaultSettings: AppSettings = {
  defaultCurrency: "CAD",
  defaultLanguage: "zh-CN",
  riskPreference: "平衡",
  aiScoreThreshold: 70,
  alertThreshold: 5,
  defaultAccountId: ""
};

let serverSettings: AppSettings = defaultSettings;

export function getSettings() {
  return serverSettings;
}

export function updateSettings(input: Partial<AppSettings>) {
  serverSettings = {
    ...serverSettings,
    defaultCurrency: input.defaultCurrency === "USD" ? "USD" : input.defaultCurrency === "CAD" ? "CAD" : serverSettings.defaultCurrency,
    defaultLanguage: input.defaultLanguage === "en-US" ? "en-US" : input.defaultLanguage === "zh-CN" ? "zh-CN" : serverSettings.defaultLanguage,
    riskPreference: isRiskPreference(input.riskPreference) ? input.riskPreference : serverSettings.riskPreference,
    aiScoreThreshold: getNumber(input.aiScoreThreshold, serverSettings.aiScoreThreshold, 0, 100),
    alertThreshold: getNumber(input.alertThreshold, serverSettings.alertThreshold, 0, 100),
    defaultAccountId: typeof input.defaultAccountId === "string" ? input.defaultAccountId : serverSettings.defaultAccountId
  };

  return serverSettings;
}

function isRiskPreference(value: unknown): value is AppSettings["riskPreference"] {
  return value === "保守" || value === "平衡" || value === "激进";
}

function getNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
