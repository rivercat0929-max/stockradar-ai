import { getSettings, updateSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET() {
  return Response.json(getSettings());
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return Response.json(updateSettings(body));
  } catch (error) {
    console.error("POST /api/settings failed", error);
    return Response.json(getSettings());
  }
}
