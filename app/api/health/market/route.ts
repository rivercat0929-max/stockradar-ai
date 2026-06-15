import { getFmpStableQuoteUrl, getYahooChartUrl } from "@/lib/market-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

const testTicker = "TSLA";

export async function GET() {
  const apiKey = process.env.FMP_API_KEY;
  const diagnostics = {
    hasFmpApiKey: Boolean(apiKey),
    apiKeyPrefix: apiKey ? apiKey.slice(0, 4) : null,
    testTicker,
    fmpEndpointVersion: "stable",
    fmpUrl: `https://financialmodelingprep.com/stable/quote?symbol=${testTicker}&apikey=[REDACTED]`,
    fmpStatus: null as number | null,
    yahooSuccess: false,
    providerUsed: null as "fmp-stable" | "yahoo" | "mock" | null,
    success: false,
    price: null as number | null,
    errorName: null as string | null,
    errorMessage: null as string | null,
    rawStatus: null as number | null
  };

  if (apiKey) {
    try {
      const fmpResponse = await fetch(getFmpStableQuoteUrl(testTicker, apiKey), { cache: "no-store" });
      const fmpStatus = fmpResponse.status;

      if (fmpResponse.ok) {
        const data = await fmpResponse.json();
        const quote = Array.isArray(data) ? data[0] : null;
        const price = typeof quote?.price === "number" ? quote.price : null;

        if (price !== null) {
          return Response.json({
            ...diagnostics,
            fmpStatus,
            providerUsed: "fmp-stable",
            success: true,
            price,
            rawStatus: fmpStatus
          });
        }

        return await yahooDiagnostics({
          ...diagnostics,
          fmpStatus,
          errorName: "FmpInvalidResponse",
          errorMessage: "FMP stable response did not include a numeric TSLA price.",
          rawStatus: fmpStatus
        });
      }

      return await yahooDiagnostics({
        ...diagnostics,
        fmpStatus,
        errorName: "FmpHttpError",
        errorMessage: `FMP stable quote request failed with status ${fmpStatus}.`,
        rawStatus: fmpStatus
      });
    } catch (error) {
      return await yahooDiagnostics({
        ...diagnostics,
        errorName: getErrorName(error),
        errorMessage: sanitizeErrorMessage(getErrorMessage(error), apiKey)
      });
    }
  }

  return yahooDiagnostics({
    ...diagnostics,
    errorName: "MissingApiKey",
    errorMessage: "FMP_API_KEY is not configured."
  });
}

async function yahooDiagnostics(base: {
  hasFmpApiKey: boolean;
  apiKeyPrefix: string | null;
  testTicker: string;
  fmpEndpointVersion: string;
  fmpUrl: string;
  fmpStatus: number | null;
  yahooSuccess: boolean;
  providerUsed: "fmp-stable" | "yahoo" | "mock" | null;
  success: boolean;
  price: number | null;
  errorName: string | null;
  errorMessage: string | null;
  rawStatus: number | null;
}) {
  try {
    const yahooResponse = await fetch(getYahooChartUrl(testTicker), { cache: "no-store" });

    if (!yahooResponse.ok) {
      return Response.json({
        ...base,
        providerUsed: "mock",
        errorName: base.errorName ?? "YahooHttpError",
        errorMessage: `${base.errorMessage ?? "Yahoo chart request failed."} Yahoo status: ${yahooResponse.status}.`
      });
    }

    const data = await yahooResponse.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;

    if (typeof price !== "number") {
      return Response.json({
        ...base,
        providerUsed: "mock",
        errorName: base.errorName ?? "YahooInvalidResponse",
        errorMessage: `${base.errorMessage ?? "Yahoo response did not include a numeric TSLA price."} Yahoo response did not include a numeric TSLA price.`
      });
    }

    return Response.json({
      ...base,
      yahooSuccess: true,
      providerUsed: "yahoo",
      success: true,
      price
    });
  } catch (error) {
    return Response.json({
      ...base,
      providerUsed: "mock",
      errorName: base.errorName ?? getErrorName(error),
      errorMessage: `${base.errorMessage ?? "Yahoo chart request failed."} ${getErrorMessage(error)}`
    });
  }
}

function getErrorName(error: unknown) {
  if (error instanceof Error) return error.name;
  return "UnknownError";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown market data request error.";
}

function sanitizeErrorMessage(message: string, apiKey: string) {
  return message.replaceAll(apiKey, "[FMP_API_KEY]");
}
