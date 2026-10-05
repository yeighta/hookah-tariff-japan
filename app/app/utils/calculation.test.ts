import { describe, expect, it } from "vitest";

import {
  calculateConsumptionTaxInJpy,
  calculateInJpy,
  calculateTariffInJpy,
  calculateTaxablePriceInJpy,
  calculateTobaccoTaxInJpy,
  estimate,
  isWithinDutyFreeLimit,
  roundDownToNearest100,
  roundDownToNearest1000,
} from "./calculation";

describe("切り捨て", () => {
  it("1,000円未満を切り捨てる", () => {
    expect(roundDownToNearest1000(10999)).toBe(10000);
    expect(roundDownToNearest1000(999)).toBe(0);
    expect(roundDownToNearest1000(1000)).toBe(1000);
  });

  it("100円未満を切り捨てる", () => {
    expect(roundDownToNearest100(2980.9)).toBe(2900);
    expect(roundDownToNearest100(99)).toBe(0);
  });
});

describe("円換算", () => {
  it("1円未満を切り捨てる", () => {
    expect(calculateInJpy(120, 149.3215)).toBe(17918);
  });

  it("課税価格は小売価格の60%", () => {
    expect(calculateTaxablePriceInJpy(100, 150)).toBe(9000);
  });
});

describe("少額免税ライン", () => {
  it("1万円ちょうどは免税、超えたら課税", () => {
    expect(isWithinDutyFreeLimit(10000)).toBe(true);
    expect(isWithinDutyFreeLimit(10000.01)).toBe(false);
  });
});

describe("関税", () => {
  it("免税ライン以下なら0円", () => {
    expect(calculateTariffInJpy(10000, true)).toBe(0);
  });

  it("課税価格を1,000円未満切り捨てて税率を掛け、100円未満を切り捨てる", () => {
    // 10,999 → 10,000 × 29.8% = 2,980 → 2,900
    expect(calculateTariffInJpy(10999, true)).toBe(2900);
    // 10,999 → 10,000 × 35% = 3,500
    expect(calculateTariffInJpy(10999, false)).toBe(3500);
  });
});

describe("たばこ税", () => {
  it("1kgあたり15,244円で、100円未満を切り捨てる", () => {
    expect(calculateTobaccoTaxInJpy(250)).toBe(3800); // 3,811
    expect(calculateTobaccoTaxInJpy(50)).toBe(700); // 762.2
    expect(calculateTobaccoTaxInJpy(1000)).toBe(15200); // 15,244
    expect(calculateTobaccoTaxInJpy(0)).toBe(0);
  });
});

describe("消費税", () => {
  it("免税ライン以下なら0円", () => {
    expect(calculateConsumptionTaxInJpy(10000, 0)).toBe(0);
  });

  it("課税価格＋関税を1,000円未満切り捨てて10%、100円未満を切り捨てる", () => {
    // 10,999 + 2,900 = 13,899 → 13,000 × 10% = 1,300
    expect(calculateConsumptionTaxInJpy(10999, 2900)).toBe(1300);
  });
});

describe("estimate", () => {
  it("課税される注文の内訳と合計", () => {
    const result = estimate({
      retailPrice: 120,
      shippingCost: 30,
      weight: 250,
      exchangeRate: 149.3215,
      isWtoMember: true,
    });

    expect(result).toEqual({
      retailPrice: 120,
      retailPriceInJpy: 17918,
      taxablePrice: expect.closeTo(10751.148, 3),
      customsDuty: 2900,
      tobaccoTax: 3800,
      consumptionTax: 1300,
      shippingCostInJpy: 4479,
      totalAmount: 30397,
    });
  });

  it("免税ライン以下でも、たばこ税だけはかかる", () => {
    const result = estimate({
      retailPrice: 100,
      shippingCost: 0,
      weight: 100,
      exchangeRate: 150,
      isWtoMember: true,
    });

    expect(result.taxablePrice).toBe(9000);
    expect(result.customsDuty).toBe(0);
    expect(result.consumptionTax).toBe(0);
    expect(result.tobaccoTax).toBe(1500); // 1,524.4
    expect(result.totalAmount).toBe(15000 + 1500);
  });

  it("WTO非加盟国は関税率35%", () => {
    const result = estimate({
      retailPrice: 200,
      shippingCost: 0,
      weight: 0,
      exchangeRate: 100,
      isWtoMember: false,
    });

    // 課税価格 12,000 × 35% = 4,200、(12,000 + 4,200) → 16,000 × 10% = 1,600
    expect(result.customsDuty).toBe(4200);
    expect(result.consumptionTax).toBe(1600);
  });
});
