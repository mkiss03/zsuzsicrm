import { NextResponse } from "next/server";

// Server-side proxy for the Frankfurter exchange-rate API.
// This avoids CORS issues that occur when the client calls the external API directly.
export async function GET() {
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=HUF&to=EUR", {
      next: { revalidate: 3600 }, // cache the rate for 1 hour
    });
    if (!res.ok) {
      return NextResponse.json({ rate: 1 / 400 });
    }
    const data = (await res.json()) as { rates?: { EUR?: number } };
    const rate = data.rates?.EUR ?? 1 / 400;
    return NextResponse.json({ rate });
  } catch {
    return NextResponse.json({ rate: 1 / 400 });
  }
}
