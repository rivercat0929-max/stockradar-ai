export function successJson<T>(data: T, init?: ResponseInit) {
  return Response.json({ success: true, data }, init);
}

export function errorJson(error: string, status = 500) {
  return Response.json({ success: false, error }, { status });
}
