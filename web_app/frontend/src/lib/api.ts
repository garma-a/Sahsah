export type HealthResponse = { status: "ok"; service: string };

export async function getHealth(): Promise<HealthResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/health`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Backend health check failed");
  return response.json() as Promise<HealthResponse>;
}
