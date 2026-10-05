// 税率は税関の公表値を確認した日付。改定があればここと各定数を更新する。
// - パイプたばこの関税・たばこ税: https://www.customs.go.jp/tsukan/yubin/tobacco.htm
// - 課税価格1万円以下の免税（たばこ税は対象外）: https://www.customs.go.jp/tetsuzuki/c-answer/imtsukan/1006_jr.htm
export const TAX_RATES_CHECKED_ON = "2026-10-05";
export const TAX_RATES_SOURCE_URL = "https://www.customs.go.jp/tsukan/yubin/tobacco.htm";

// たばこ税＋たばこ特別税（パイプたばこ、1kgあたり円）
export const TOBACCO_TAX_RATE = 15244;
// 消費税＋地方消費税
export const CONSUMPTION_TAX_RATE = 0.1;
// 個人使用目的の輸入では、海外小売価格の60%を課税価格とする
export const TAXABLE_PRICE_RATIO = 0.6;
// 課税価格がこの額以下なら関税・消費税は免除（たばこ税は免除されない）
export const DUTY_FREE_LIMIT_JPY = 10000;
// パイプたばこの関税率（協定税率 / 基本税率）
export const TARIFF_RATE_WTO = 0.298;
export const TARIFF_RATE_NON_WTO = 0.35;

export interface CalculationResult {
  retailPrice: number;
  retailPriceInJpy: number;
  taxablePrice: number;
  customsDuty: number;
  tobaccoTax: number;
  consumptionTax: number;
  shippingCostInJpy: number;
  totalAmount: number;
}

// 1000円未満切り捨て関数
export function roundDownToNearest1000(amount: number): number {
  return Math.floor(amount / 1000) * 1000;
}

// 100円未満切り捨て関数
export function roundDownToNearest100(amount: number): number {
  return Math.floor(amount / 100) * 100;
}

// たばこ税の計算
export function calculateTobaccoTaxInJpy(weight: number): number {
  return roundDownToNearest100((weight * TOBACCO_TAX_RATE) / 1000);
}

// 課税価格の計算
export function calculateTaxablePriceInJpy(retailPrice: number, exchangeRate: number): number {
  return retailPrice * TAXABLE_PRICE_RATIO * exchangeRate;
}

// 課税価格が少額免税の範囲（1万円以下）に収まるか
export function isWithinDutyFreeLimit(taxablePriceJpy: number): boolean {
  return taxablePriceJpy <= DUTY_FREE_LIMIT_JPY;
}

// 関税の計算
export function calculateTariffInJpy(taxablePriceJpy: number, isWtoMember: boolean): number {
  if (isWithinDutyFreeLimit(taxablePriceJpy)) {
    return 0;
  }
  
  const tariffRate = isWtoMember ? TARIFF_RATE_WTO : TARIFF_RATE_NON_WTO;
  const taxablePriceRownded = roundDownToNearest1000(taxablePriceJpy);
  const tariff = taxablePriceRownded * tariffRate;
  return roundDownToNearest100(tariff);
}
  
// 消費税の計算
export function calculateConsumptionTaxInJpy(taxablePriceJpy: number, tariffJpy: number): number {
  if (isWithinDutyFreeLimit(taxablePriceJpy)) {
    return 0;
  }

  const baseForConsumptionTax = roundDownToNearest1000(taxablePriceJpy + tariffJpy);
  return roundDownToNearest100(baseForConsumptionTax * CONSUMPTION_TAX_RATE);  
}
 
export function calculateInJpy(cost: number, exchangeRate: number): number {
  return Math.floor(cost * exchangeRate);
}

export function calculateTotalAmountInJpy(retailPriceJpy: number, customsDutyJpy: number, tobaccoTaxJpy: number, consumptionTaxJpy: number, shippingCostJpy: number): number {
  return retailPriceJpy + customsDutyJpy + tobaccoTaxJpy + consumptionTaxJpy + shippingCostJpy;
}

export interface EstimateInput {
  retailPrice: number;
  shippingCost: number;
  weight: number;
  exchangeRate: number;
  isWtoMember: boolean;
}

export function estimate({ retailPrice, shippingCost, weight, exchangeRate, isWtoMember }: EstimateInput): CalculationResult {
  const retailPriceInJpy = calculateInJpy(retailPrice, exchangeRate);
  const taxablePrice = calculateTaxablePriceInJpy(retailPrice, exchangeRate);
  const customsDuty = calculateTariffInJpy(taxablePrice, isWtoMember);
  const tobaccoTax = calculateTobaccoTaxInJpy(weight);
  const consumptionTax = calculateConsumptionTaxInJpy(taxablePrice, customsDuty);
  const shippingCostInJpy = calculateInJpy(shippingCost, exchangeRate);

  return {
    retailPrice,
    retailPriceInJpy,
    taxablePrice,
    customsDuty,
    tobaccoTax,
    consumptionTax,
    shippingCostInJpy,
    totalAmount: calculateTotalAmountInJpy(retailPriceInJpy, customsDuty, tobaccoTax, consumptionTax, shippingCostInJpy),
  };
}
