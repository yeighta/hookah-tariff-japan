const TOBACCO_TAX_RATE = 15244;
const CONSUMPTION_TAX_RATE = 0.1;
const TARIFF_RATE_WTO = 0.298;
const TARIFF_RATE_NON_WTO = 0.35;

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
  return retailPrice * 0.6 * exchangeRate;
}

function isTaxablePriceLessThan10000(taxablePriceJpy: number): boolean {
  return taxablePriceJpy <= 10000;
}

// 関税の計算
export function calculateTariffInJpy(taxablePriceJpy: number, isWtoMember: boolean): number {
  if (isTaxablePriceLessThan10000(taxablePriceJpy)) {
    return 0;
  }
  
  const tariffRate = isWtoMember ? TARIFF_RATE_WTO : TARIFF_RATE_NON_WTO;
  const taxablePriceRownded = roundDownToNearest1000(taxablePriceJpy);
  const tariff = taxablePriceRownded * tariffRate;
  return roundDownToNearest100(tariff);
}
  
// 消費税の計算
export function calculateConsumptionTaxInJpy(taxablePriceJpy: number, tariffJpy: number): number {
  if (isTaxablePriceLessThan10000(taxablePriceJpy)) {
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
