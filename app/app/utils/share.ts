export const CURRENCY_CODES = ["USD", "EUR", "RUB", "HKD"] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];

// What a shared link carries. Amounts stay strings so they round-trip exactly as typed.
export interface ShareState {
  currency: CurrencyCode;
  price: string;
  shipping: string;
  weight: string;
  isWtoMember: boolean;
}

export const DEFAULT_SHARE_STATE: ShareState = {
  currency: "USD",
  price: "",
  shipping: "",
  weight: "",
  isWtoMember: true,
};

const AMOUNT = /^\d{1,9}(\.\d{1,4})?$/;

function amount(value: string | null) {
  return value && AMOUNT.test(value) ? value : "";
}

export function parseShareParams(params: URLSearchParams): ShareState {
  const currency = params.get("currency")?.toUpperCase();
  return {
    currency: CURRENCY_CODES.includes(currency as CurrencyCode)
      ? (currency as CurrencyCode)
      : DEFAULT_SHARE_STATE.currency,
    price: amount(params.get("price")),
    shipping: amount(params.get("shipping")),
    weight: amount(params.get("weight")),
    isWtoMember: params.get("wto") !== "0",
  };
}

// Defaults are left out so a plain visit keeps a clean URL.
export function toShareParams(state: ShareState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.currency !== DEFAULT_SHARE_STATE.currency) params.set("currency", state.currency);
  if (amount(state.price)) params.set("price", state.price);
  if (amount(state.shipping)) params.set("shipping", state.shipping);
  if (amount(state.weight)) params.set("weight", state.weight);
  if (!state.isWtoMember) params.set("wto", "0");
  return params;
}

export function hasShareInput(state: ShareState) {
  return [state.price, state.shipping, state.weight].some((v) => parseFloat(v) > 0);
}
