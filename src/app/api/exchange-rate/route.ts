import { NextResponse } from "next/server";

// Server-side proxy for the Frankfurter exchange-rate API.
// Returns the EUR→HUF rate (e.g. 395 means 1 EUR = 395 HUF).
export async function GET() {
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=EUR&to=HUF", {
      next: { revalidate: 3600 }, // cache the rate for 1 hour
    });
    if (!res.ok) {
      return NextResponse.json({ rate: 395 });
    }
    const data = (await res.json()) as { rates?: { HUF?: number } };
    const rate = data.rates?.HUF ?? 395;
    return NextResponse.json({ rate });
  } catch {
    return NextResponse.json({ rate: 395 });
  }
}
