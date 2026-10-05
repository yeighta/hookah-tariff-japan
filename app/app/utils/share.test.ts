import { describe, expect, it } from "vitest";

import { DEFAULT_SHARE_STATE, hasShareInput, parseShareParams, toShareParams } from "./share";

const parse = (query: string) => parseShareParams(new URLSearchParams(query));

describe("parseShareParams", () => {
  it("パラメータがなければ初期値", () => {
    expect(parse("")).toEqual(DEFAULT_SHARE_STATE);
  });

  it("共有URLの値を読み取る", () => {
    expect(parse("currency=EUR&price=120&shipping=30.5&weight=250&wto=0")).toEqual({
      currency: "EUR",
      price: "120",
      shipping: "30.5",
      weight: "250",
      isWtoMember: false,
    });
  });

  it("通貨コードは小文字でも受け付ける", () => {
    expect(parse("currency=hkd").currency).toBe("HKD");
  });

  it("対応していない通貨や不正な数値は無視する", () => {
    const state = parse("currency=GBP&price=-5&shipping=abc&weight=1e9");
    expect(state.currency).toBe("USD");
    expect(state.price).toBe("");
    expect(state.shipping).toBe("");
    expect(state.weight).toBe("");
  });
});

describe("toShareParams", () => {
  it("初期値の項目は省いて短いURLにする", () => {
    expect(toShareParams({ ...DEFAULT_SHARE_STATE, price: "120", weight: "250" }).toString()).toBe(
      "price=120&weight=250"
    );
  });

  it("parseShareParams と往復できる", () => {
    const state = { currency: "RUB" as const, price: "9800", shipping: "1500", weight: "1000", isWtoMember: false };
    expect(parseShareParams(toShareParams(state))).toEqual(state);
  });
});

describe("hasShareInput", () => {
  it("金額か重量のどれかが入っていれば true", () => {
    expect(hasShareInput(DEFAULT_SHARE_STATE)).toBe(false);
    expect(hasShareInput({ ...DEFAULT_SHARE_STATE, weight: "50" })).toBe(true);
    expect(hasShareInput({ ...DEFAULT_SHARE_STATE, price: "0" })).toBe(false);
  });
});
