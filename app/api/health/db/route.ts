import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

let prismaClient: PrismaClient | null = null;

function getPrisma() {
  if (!prismaClient) {
    prismaClient = new PrismaClient();
  }

  return prismaClient;
}

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL;
  const diagnostics = {
    hasDatabaseUrl: Boolean(databaseUrl),
    databaseUrlPrefix: databaseUrl ? databaseUrl.slice(0, 20) : null,
    databaseUrlHost: getDatabaseUrlHost(databaseUrl),
    prismaConnected: false,
    errorName: null as string | null,
    errorMessage: null as string | null
  };

  if (!databaseUrl) {
    return Response.json(diagnostics);
  }

  try {
    await getPrisma().holding.count();
    return Response.json({
      ...diagnostics,
      prismaConnected: true
    });
  } catch (error) {
    return Response.json({
      ...diagnostics,
      errorName: getErrorName(error),
      errorMessage: sanitizeErrorMessage(getErrorMessage(error), databaseUrl)
    });
  }
}

function getDatabaseUrlHost(databaseUrl: string | undefined) {
  if (!databaseUrl) return null;

  try {
    return new URL(databaseUrl).host;
  } catch {
    return null;
  }
}

function getErrorName(error: unknown) {
  if (error instanceof Error) return error.name;
  return "UnknownError";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown database error";
}

function sanitizeErrorMessage(message: string, databaseUrl: string) {
  let sanitized = message.replaceAll(databaseUrl, "[DATABASE_URL]");

  try {
    const parsed = new URL(databaseUrl);
    if (parsed.password) {
      sanitized = sanitized.replaceAll(parsed.password, "[PASSWORD]");
    }
    if (parsed.username) {
      sanitized = sanitized.replaceAll(parsed.username, "[USER]");
    }
  } catch {
    // If DATABASE_URL is malformed, only the full-string redaction above applies.
  }

  return sanitized;
}
