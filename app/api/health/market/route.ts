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
    fmpUrl: `https://financialmodelingprep.com/api/v3/quote/${testTicker}?apikey=[REDACTED]`,
    success: false,
    price: null as number | null,
    errorName: null as string | null,
    errorMessage: null as string | null,
    rawStatus: null as number | null
  };

  if (!apiKey) {
    return Response.json({
      ...diagnostics,
      errorName: "MissingApiKey",
      errorMessage: "FMP_API_KEY is not configured."
    });
  }

  try {
    const response = await fetch(
      `https://financialmodelingprep.com/api/v3/quote/${testTicker}?apikey=${encodeURIComponent(apiKey)}`,
      { cache: "no-store" }
    );
    const rawStatus = response.status;

    if (!response.ok) {
      return Response.json({
        ...diagnostics,
        rawStatus,
        errorName: "FmpHttpError",
        errorMessage: `FMP quote request failed with status ${rawStatus}.`
      });
    }

    const data = await response.json();
    const quote = Array.isArray(data) ? data[0] : null;
    const price = typeof quote?.price === "number" ? quote.price : null;

    if (price === null) {
      return Response.json({
        ...diagnostics,
        rawStatus,
        errorName: "FmpInvalidResponse",
        errorMessage: "FMP response did not include a numeric TSLA price."
      });
    }

    return Response.json({
      ...diagnostics,
      success: true,
      price,
      rawStatus
    });
  } catch (error) {
    return Response.json({
      ...diagnostics,
      errorName: getErrorName(error),
      errorMessage: sanitizeErrorMessage(getErrorMessage(error), apiKey)
    });
  }
}

function getErrorName(error: unknown) {
  if (error instanceof Error) return error.name;
  return "UnknownError";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown FMP request error.";
}

function sanitizeErrorMessage(message: string, apiKey: string) {
  return message.replaceAll(apiKey, "[FMP_API_KEY]");
}
