const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface ReportParameter {
  id: number;
  position: number;
  name: string;
  value: string | null;
  unit: string | null;
  referenceRange: string | null;
}

export interface Report {
  id: number;
  reportCode: string;
  fileName: string;
  createdAt: string;
  parameters: ReportParameter[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new Error("Could not reach the server. Is the backend running?");
  }

  const body = await res.json();
  // NestJS sends errors as { statusCode, message }
  if (!res.ok) throw new Error(body.message);
  return body;
}

export function getReports() {
  return request<Report[]>("/reports");
}

export function uploadReport(data: FormData) {
  return request<Report>("/reports", { method: "POST", body: data });
}
