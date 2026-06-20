import { getCacheStats } from "@/lib/cache";
import { getFmpStableQuoteUrl, getYahooChartUrl } from "@/lib/market-data";

export type DataSourceKind = "真实数据" | "缓存数据" | "估算数据" | "示例数据";
export type HealthStatus = "正常" | "异常" | "未配置" | "降级中";

export type ProviderHealth = {
  name: "FMP" | "Yahoo" | "本地缓存";
  status: HealthStatus;
  label: DataSourceKind;
  lastUpdatedAt: string | null;
  failureCount: number;
  isUsingFallback: boolean;
  message: string;
};

export type ApiKeyHealth = {
  exists: boolean;
  prefix: string | null;
  usable: boolean;
  rateLimited: boolean;
  statusCode: number | null;
  message: string;
};

export type DataHealthResult = {
  checkedAt: string;
  providers: ProviderHealth[];
  apiKey: ApiKeyHealth;
  cache: {
    totalEntries: number;
    activeEntries: number;
    staleEntries: number;
    lastUpdatedAt: string | null;
    label: DataSourceKind;
  };
  currentFallback: boolean;
  failureCount: number;
};

const testTicker = "TSLA";
let providerFailures = {
  fmp: 0,
  yahoo: 0
};

export async function getDataHealth(): Promise<DataHealthResult> {
  const checkedAt = new Date().toISOString();
  const [fmp, yahoo] = await Promise.all([checkFmp(), checkYahoo()]);
  const cacheStats = getCacheStats();
  const cacheProvider: ProviderHealth = {
    name: "本地缓存",
    status: cacheStats.totalEntries > 0 ? "正常" : "未配置",
    label: "缓存数据",
    lastUpdatedAt: cacheStats.lastUpdatedAt,
    failureCount: 0,
    isUsingFallback: fmp.provider.status !== "正常" || yahoo.status !== "正常",
    message: cacheStats.totalEntries > 0 ? `缓存条目 ${cacheStats.totalEntries} 个。` : "当前服务进程暂无缓存条目。"
  };
  const providers = [fmp.provider, yahoo, cacheProvider];

  return {
    checkedAt,
    providers,
    apiKey: fmp.apiKey,
    cache: {
      ...cacheStats,
      label: "缓存数据"
    },
    currentFallback: providers.some((provider) => provider.isUsingFallback),
    failureCount: providerFailures.fmp + providerFailures.yahoo
  };
}

async function checkFmp() {
  const apiKey = process.env.FMP_API_KEY;
  const baseApiKey: ApiKeyHealth = {
    exists: Boolean(apiKey),
    prefix: apiKey ? apiKey.slice(0, 4) : null,
    usable: false,
    rateLimited: false,
    statusCode: null,
    message: apiKey ? "已配置 FMP_API_KEY。" : "未配置 FMP_API_KEY。"
  };

  if (!apiKey) {
    return {
      provider: {
        name: "FMP" as const,
        status: "未配置" as const,
        label: "真实数据" as const,
        lastUpdatedAt: null,
        failureCount: providerFailures.fmp,
        isUsingFallback: true,
        message: "缺少 FMP_API_KEY，系统会尝试 Yahoo 或缓存 fallback。"
      },
      apiKey: baseApiKey
    };
  }

  try {
    const response = await fetch(getFmpStableQuoteUrl(testTicker, apiKey), { cache: "no-store" });
    const statusCode = response.status;
    const rateLimited = statusCode === 429 || statusCode === 402 || statusCode === 403;

    if (!response.ok) {
      providerFailures.fmp += 1;
      return {
        provider: {
          name: "FMP" as const,
          status: rateLimited ? "降级中" as const : "异常" as const,
          label: "真实数据" as const,
          lastUpdatedAt: new Date().toISOString(),
          failureCount: providerFailures.fmp,
          isUsingFallback: true,
          message: rateLimited ? "FMP 可能触发免费额度或权限限制。" : `FMP 返回状态 ${statusCode}。`
        },
        apiKey: {
          ...baseApiKey,
          statusCode,
          rateLimited,
          message: rateLimited ? "API Key 可识别，但可能触发免费额度限制。" : `API Key 请求返回 ${statusCode}。`
        }
      };
    }

    const data = await response.json();
    const quote = Array.isArray(data) ? data[0] : null;
    const usable = typeof quote?.price === "number";
    if (!usable) providerFailures.fmp += 1;

    return {
      provider: {
        name: "FMP" as const,
        status: usable ? "正常" as const : "异常" as const,
        label: "真实数据" as const,
        lastUpdatedAt: new Date().toISOString(),
        failureCount: providerFailures.fmp,
        isUsingFallback: !usable,
        message: usable ? "FMP stable quote 可用。" : "FMP 响应缺少有效价格。"
      },
      apiKey: {
        ...baseApiKey,
        usable,
        statusCode,
        message: usable ? "API Key 可用。" : "API Key 已配置，但响应数据不可用。"
      }
    };
  } catch (error) {
    providerFailures.fmp += 1;
    return {
      provider: {
        name: "FMP" as const,
        status: "异常" as const,
        label: "真实数据" as const,
        lastUpdatedAt: new Date().toISOString(),
        failureCount: providerFailures.fmp,
        isUsingFallback: true,
        message: error instanceof Error ? sanitize(error.message, apiKey) : "FMP 检查失败。"
      },
      apiKey: {
        ...baseApiKey,
        message: "API Key 检查请求失败。"
      }
    };
  }
}

async function checkYahoo(): Promise<ProviderHealth> {
  try {
    const response = await fetch(getYahooChartUrl(testTicker), { cache: "no-store" });
    if (!response.ok) {
      providerFailures.yahoo += 1;
      return {
        name: "Yahoo",
        status: "异常",
        label: "缓存数据",
        lastUpdatedAt: new Date().toISOString(),
        failureCount: providerFailures.yahoo,
        isUsingFallback: true,
        message: `Yahoo 返回状态 ${response.status}。`
      };
    }

    const data = await response.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    const usable = typeof price === "number";
    if (!usable) providerFailures.yahoo += 1;

    return {
      name: "Yahoo",
      status: usable ? "正常" : "异常",
      label: "缓存数据",
      lastUpdatedAt: new Date().toISOString(),
      failureCount: providerFailures.yahoo,
      isUsingFallback: false,
      message: usable ? "Yahoo fallback 可用。" : "Yahoo 响应缺少有效价格。"
    };
  } catch (error) {
    providerFailures.yahoo += 1;
    return {
      name: "Yahoo",
      status: "异常",
      label: "缓存数据",
      lastUpdatedAt: new Date().toISOString(),
      failureCount: providerFailures.yahoo,
      isUsingFallback: true,
      message: error instanceof Error ? error.message : "Yahoo 检查失败。"
    };
  }
}

function sanitize(message: string, apiKey: string) {
  return message.replaceAll(apiKey, "[FMP_API_KEY]");
}
