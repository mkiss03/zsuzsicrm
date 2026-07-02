// All monetary amounts across the app are treated as EUR. Payments can be
// recorded in HUF (e.g. via the "huf_account" bank account), so anywhere
// payment amounts are summed or displayed as EUR they must first be
// converted using the current EUR→HUF rate — otherwise a HUF payment shows
// up as a wildly inflated "EUR" number.

export function toEur(amount: number, currency: string | null | undefined, eurHufRate: number): number {
  if (currency === "HUF" && eurHufRate > 0) return amount / eurHufRate;
  return amount;
}

export interface PaymentLike {
  amount: number;
  type: string;
  currency?: string | null;
}

export function sumPaymentsEur(payments: PaymentLike[], eurHufRate: number): number {
  return payments.reduce((sum, p) => {
    const eur = toEur(p.amount, p.currency, eurHufRate);
    return p.type === "refund" ? sum - eur : sum + eur;
  }, 0);
}

export async function fetchEurHufRate(): Promise<number> {
  try {
    const res = await fetch("/api/exchange-rate");
    const data = (await res.json()) as { rate?: number };
    return data.rate ?? 395;
  } catch {
    return 395;
  }
}
