/**
 * Server-side proxy for external API calls.
 * Avoids browser CORS/mixed-content restrictions (HTTP endpoints from HTTPS page).
 */
import { NextRequest, NextResponse } from "next/server";

export interface ProxyRequest {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  params?: Record<string, string | number | null | undefined>;
  body?: unknown;
}

export async function POST(request: NextRequest) {
  let payload: ProxyRequest;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { url, method = "GET", headers = {}, params = {}, body } = payload;

  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  try {
    const targetUrl = new URL(url);

    // Append query params, skip null/undefined
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        targetUrl.searchParams.set(key, String(value));
      }
    });

    const fetchOptions: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    if (body && method !== "GET") {
      fetchOptions.body = JSON.stringify(body);
    }

    const startTime = Date.now();
    const res = await fetch(targetUrl.toString(), fetchOptions);
    const duration = Date.now() - startTime;

    let data: unknown;
    const contentType = res.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    return NextResponse.json({
      status: res.status,
      statusText: res.statusText,
      duration,
      data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
