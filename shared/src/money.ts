/** ISO-4217 currencies whose minor unit is not two decimal places. */
const EXPONENTS: Record<string, number> = {
  // zero-decimal
  JPY: 0,
  KRW: 0,
  VND: 0,
  CLP: 0,
  ISK: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  VUV: 0,
  GNF: 0,
  KMF: 0,
  DJF: 0,
  BIF: 0,
  // three-decimal
  BHD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
  IQD: 3,
  JOD: 3,
  LYD: 3,
};

/** Number of decimal places in the minor unit of a currency. Defaults to 2. */
export function minorExponent(currency: string): number {
  return EXPONENTS[currency.toUpperCase()] ?? 2;
}

/** Convert a decimal amount to integer minor units, rounding to the nearest. */
export function toMinor(amount: number, currency: string): number {
  return Math.round(amount * 10 ** minorExponent(currency));
}

/** Convert integer minor units back to a decimal amount. */
export function fromMinor(minor: number, currency: string): number {
  return minor / 10 ** minorExponent(currency);
}
