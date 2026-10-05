import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { json } from "@remix-run/node";
import type { MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import {
  CONSUMPTION_TAX_RATE,
  DUTY_FREE_LIMIT_JPY,
  TARIFF_RATE_NON_WTO,
  TARIFF_RATE_WTO,
  TAXABLE_PRICE_RATIO,
  TAX_RATES_CHECKED_ON,
  TAX_RATES_SOURCE_URL,
  TOBACCO_TAX_RATE,
  estimate,
  isWithinDutyFreeLimit,
  roundDownToNearest1000,
} from "~/utils/calculation";

const CURRENCIES = [
  { code: "USD", name: "米ドル" },
  { code: "EUR", name: "ユーロ" },
  { code: "RUB", name: "ルーブル" },
  { code: "HKD", name: "香港ドル" },
] as const;

type CurrencyCode = (typeof CURRENCIES)[number]["code"];

const WEIGHT_PRESETS = [50, 100, 200, 250, 1000];

export const meta: MetaFunction = () => {
  const title = "シーシャ輸入税計算｜関税・たばこ税・消費税の見積もり";
  const description =
    "海外から個人輸入するシーシャフレーバーの関税・たばこ税・消費税を、価格と重量からその場で見積もります。";
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "Shisha Tariff Calculator for Japan" },
    { name: "twitter:card", content: "summary" },
  ];
};

// Rates are fetched once against USD and turned into "JPY per 1 unit" for every
// supported currency, so switching currency never needs a round trip.
export const loader = async () => {
  try {
    const response = await fetch(
      `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/latest/USD`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const jpy: number = data.conversion_rates.JPY;
    const rates = Object.fromEntries(
      CURRENCIES.map(({ code }) => [code, jpy / data.conversion_rates[code]])
    ) as Record<CurrencyCode, number>;

    return json(
      { rates, updatedAt: data.time_last_update_unix as number },
      { headers: { "Cache-Control": "public, max-age=600, s-maxage=3600" } }
    );
  } catch (error) {
    console.error("為替レートの取得に失敗しました:", error);
    return json({ rates: null, updatedAt: null });
  }
};

const yen = (n: number) => Math.round(n).toLocaleString("ja-JP");
const percent = (r: number) => `${(r * 100).toLocaleString("ja-JP", { maximumFractionDigits: 1 })}%`;
const formatRate = (r: number) =>
  r.toLocaleString("ja-JP", { maximumFractionDigits: r < 10 ? 3 : 2, minimumFractionDigits: 2 });

// Accepts what people actually type on a Japanese keyboard: full-width digits,
// commas, a stray full-width period.
function sanitizeNumber(raw: string) {
  const halfWidth = raw
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, ".")
    .replace(/[^0-9.]/g, "");
  const [whole, ...rest] = halfWidth.split(".");
  return rest.length ? `${whole}.${rest.join("")}` : whole;
}

const toNumber = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function Index() {
  const { rates, updatedAt } = useLoaderData<typeof loader>();

  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [retailPrice, setRetailPrice] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [weight, setWeight] = useState("");
  const [isWtoMember, setIsWtoMember] = useState(true);
  const [manualRate, setManualRate] = useState("");

  const exchangeRate = rates ? rates[currency] : toNumber(manualRate);
  const result = estimate({
    retailPrice: toNumber(retailPrice),
    shippingCost: toNumber(shippingCost),
    weight: toNumber(weight),
    exchangeRate,
    isWtoMember,
  });
  const hasInput = toNumber(retailPrice) > 0 || toNumber(shippingCost) > 0 || toNumber(weight) > 0;
  const canCalculate = exchangeRate > 0;

  return (
    <div className="relative isolate min-h-screen overflow-x-clip">
      <Backdrop />

      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pt-5 sm:px-8 sm:pt-8">
        <a href="/" className="flex items-center gap-2.5 rounded-md text-ink">
          <BrandMark className="h-8 w-8" />
          <h1 id="page-title" className="text-[15px] font-bold tracking-wide">
            シーシャ輸入税計算
          </h1>
        </a>
        {rates && updatedAt ? (
          <p className="hidden text-right text-xs leading-relaxed text-ink-soft sm:block">
            為替レートは
            <time dateTime={new Date(updatedAt * 1000).toISOString()}>
              {new Intl.DateTimeFormat("ja-JP", {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Tokyo",
              }).format(new Date(updatedAt * 1000))}
            </time>
            時点
          </p>
        ) : null}
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 pb-28 pt-8 sm:px-8 sm:pt-12 lg:grid-cols-12 lg:gap-12 lg:pb-24">
        <section aria-labelledby="page-title" className="enter lg:col-span-7">
          <p id="page-lead" className="max-w-[34em] text-[15px] leading-[1.9] text-ink-soft">
            海外ショップの価格と重量を入れると、関税・たばこ税・消費税を含めた支払い総額をその場で見積もります。
          </p>

          <form
            className="mt-8 space-y-9"
            onSubmit={(e) => e.preventDefault()}
            noValidate
            aria-describedby="page-lead"
          >
            <CurrencyPicker value={currency} onChange={setCurrency} rates={rates} />

            {!rates && (
              <div role="status" className="rounded-2xl border border-ember/60 bg-white/70 p-5">
                <p className="text-sm font-bold text-ink">為替レートを取得できませんでした</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  1 {currency} あたりの円を入力すると、そのまま計算できます。
                </p>
                <div className="mt-4 max-w-xs">
                  <AmountField
                    label="為替レート"
                    suffix={`円 / ${currency}`}
                    value={manualRate}
                    onChange={setManualRate}
                    placeholder="例 149.5"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-x-6 gap-y-7 sm:grid-cols-2">
              <AmountField
                label="商品価格"
                suffix={currency}
                value={retailPrice}
                onChange={setRetailPrice}
                placeholder="0"
                hint={canCalculate && toNumber(retailPrice) > 0 ? `約 ${yen(result.retailPriceInJpy)}円` : "送料を除いた合計"}
              />
              <AmountField
                label="送料"
                suffix={currency}
                value={shippingCost}
                onChange={setShippingCost}
                placeholder="0"
                hint={canCalculate && toNumber(shippingCost) > 0 ? `約 ${yen(result.shippingCostInJpy)}円` : "課税価格には含まれません"}
              />
            </div>

            <WeightField value={weight} onChange={setWeight} />

            <WtoSwitch checked={isWtoMember} onChange={setIsWtoMember} />
          </form>
        </section>

        <ResultPanel
          result={result}
          hasInput={hasInput && canCalculate}
          currency={currency}
          exchangeRate={exchangeRate}
          retailPrice={toNumber(retailPrice)}
          shippingCost={toNumber(shippingCost)}
          weight={toNumber(weight)}
          isWtoMember={isWtoMember}
        />
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-12 sm:px-8">
        <div className="max-w-[46em] border-t border-mist-line pt-6 text-xs leading-[1.9] text-ink-faint">
          <p>
            個人輸入の場合、課税価格は商品価格の{percent(TAXABLE_PRICE_RATIO)}として計算しています。
            表示は目安で、実際の税額は税関が公示するレートと判断によって決まります。
          </p>
          <p className="mt-2">
            税率は
            <a
              className="underline decoration-mist-line underline-offset-4 hover:text-ink"
              href={TAX_RATES_SOURCE_URL}
              target="_blank"
              rel="noreferrer"
            >
              税関の公表値
            </a>
            （
            <time dateTime={TAX_RATES_CHECKED_ON}>
              {new Intl.DateTimeFormat("ja-JP", { dateStyle: "long", timeZone: "Asia/Tokyo" }).format(
                new Date(`${TAX_RATES_CHECKED_ON}T00:00:00+09:00`)
              )}
            </time>
            時点）。為替レート提供{" "}
            <a
              className="underline decoration-mist-line underline-offset-4 hover:text-ink"
              href="https://www.exchangerate-api.com"
              target="_blank"
              rel="noreferrer"
            >
              ExchangeRate-API
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

function Backdrop() {
  // A slow drift of smoke behind the page; purely atmospheric, never behind text that needs contrast.
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-40 -top-48 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(closest-side,rgba(185,163,227,0.28),transparent)] blur-2xl" />
      <div className="absolute -right-24 top-40 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(closest-side,rgba(141,181,168,0.35),transparent)] blur-2xl" />
    </div>
  );
}

function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M11 4.5h10l-2 4h-6z" fill="#D4AE55" />
      <rect x="15" y="8.5" width="2" height="9" rx="1" fill="#0D3D36" />
      <path d="M12 13h8" stroke="#0D3D36" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="23.5" r="6.5" fill="#0D3D36" />
      <path d="M11.2 24.5a5 5 0 0 0 9.6 0z" fill="#8DB5A8" />
    </svg>
  );
}

function CurrencyPicker({
  value,
  onChange,
  rates,
}: {
  value: CurrencyCode;
  onChange: (code: CurrencyCode) => void;
  rates: Record<CurrencyCode, number> | null;
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-bold text-ink">ショップの通貨</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CURRENCIES.map(({ code, name }) => {
          const selected = value === code;
          return (
            <label
              key={code}
              className={`group relative flex cursor-pointer flex-col rounded-2xl border px-4 py-3 transition-[background-color,border-color,box-shadow] duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-glass has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-mist ${
                selected
                  ? "border-glass bg-glass text-leaf shadow-[0_10px_24px_-14px_rgba(8,44,39,0.8)]"
                  : "border-mist-line bg-white/60 text-ink hover:border-ink-faint hover:bg-white"
              }`}
            >
              <input
                type="radio"
                name="currency"
                value={code}
                checked={selected}
                onChange={() => onChange(code)}
                className="sr-only"
              />
              <span className="flex items-baseline justify-between gap-2">
                <span className="num text-lg font-semibold tracking-wide">{code}</span>
                <span className={`text-xs ${selected ? "text-sage" : "text-ink-faint"}`}>{name}</span>
              </span>
              <span className={`num mt-1 text-xs ${selected ? "text-brass" : "text-ink-soft"}`}>
                {rates ? `${formatRate(rates[code])}円` : "レート未取得"}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function AmountField({
  label,
  suffix,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  suffix: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-3 block text-sm font-bold text-ink">
        {label}
      </label>
      <div className="group relative flex items-baseline border-b-2 border-mist-line pb-2 transition-colors duration-200 focus-within:border-glass hover:border-ink-faint focus-within:hover:border-glass">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(sanitizeNumber(e.target.value))}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className="num min-w-0 flex-1 bg-transparent text-[2rem] font-semibold leading-none tracking-tight text-ink placeholder:text-mist-line focus:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <span className="num shrink-0 pl-3 text-sm font-medium text-ink-soft">{suffix}</span>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="num mt-2 text-xs text-ink-soft" aria-live="polite">
          {hint}
        </p>
      )}
    </div>
  );
}

function WeightField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = useId();
  const current = toNumber(value);
  return (
    <div>
      <label htmlFor={id} className="mb-3 block text-sm font-bold text-ink">
        たばこの重量
      </label>
      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 sm:gap-x-6">
        <div className="flex items-baseline border-b-2 border-mist-line pb-2 transition-colors duration-200 focus-within:border-glass hover:border-ink-faint focus-within:hover:border-glass">
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={value}
            placeholder="0"
            onChange={(e) => onChange(sanitizeNumber(e.target.value))}
            aria-describedby={`${id}-hint`}
            className="num min-w-0 flex-1 bg-transparent text-[2rem] font-semibold leading-none tracking-tight text-ink placeholder:text-mist-line focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <span className="num shrink-0 pl-3 text-sm font-medium text-ink-soft">g</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:pt-3" role="group" aria-label="よくある内容量">
          {WEIGHT_PRESETS.map((g) => {
            const active = current === g;
            return (
              <button
                key={g}
                type="button"
                onClick={() => onChange(String(g))}
                aria-pressed={active}
                className={`num rounded-full border px-2.5 py-1.5 text-[13px] leading-none transition-colors duration-150 ${
                  active
                    ? "border-glass bg-glass text-leaf"
                    : "border-mist-line bg-white/60 text-ink-soft hover:border-ink-faint hover:text-ink"
                }`}
              >
                {g >= 1000 ? `${g / 1000}kg` : `${g}g`}
              </button>
            );
          })}
        </div>
      </div>
      <p id={`${id}-hint`} className="mt-2 text-xs text-ink-soft">
        複数個ならすべての合計。パッケージに記載の正味量です。
      </p>
    </div>
  );
}

function WtoSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-6 rounded-2xl border border-mist-line bg-white/60 p-5">
      <div>
        <p id={`${id}-label`} className="text-sm font-bold text-ink">
          原産国がWTO加盟国
        </p>
        <p id={`${id}-desc`} className="mt-1 text-xs leading-relaxed text-ink-soft">
          関税率は加盟国なら{percent(TARIFF_RATE_WTO)}、それ以外は{percent(TARIFF_RATE_NON_WTO)}。主要な生産国はほぼすべて加盟しています。
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-desc`}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 ${
          checked ? "bg-glass" : "bg-mist-line"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-out ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

type Line = {
  key: string;
  label: string;
  amount: number;
  swatch: string;
  formula: string[];
};

function ResultPanel({
  result,
  hasInput,
  currency,
  exchangeRate,
  retailPrice,
  shippingCost,
  weight,
  isWtoMember,
}: {
  result: ReturnType<typeof estimate>;
  hasInput: boolean;
  currency: string;
  exchangeRate: number;
  retailPrice: number;
  shippingCost: number;
  weight: number;
  isWtoMember: boolean;
}) {
  const total = hasInput ? result.totalAmount : 0;
  const announced = useDebounced(total, 700);
  const settled = useDebounced(total, 450);
  const [puffs, setPuffs] = useState(0);
  const lastSettled = useRef(settled);
  useEffect(() => {
    if (settled > 0 && settled !== lastSettled.current) setPuffs((n) => n + 1);
    lastSettled.current = settled;
  }, [settled]);
  const totalRef = useRef<HTMLDivElement>(null);
  const [totalBelow, setTotalBelow] = useState(false);

  useEffect(() => {
    const el = totalRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setTotalBelow(!entry.isIntersecting && entry.boundingClientRect.top > 0), {
      threshold: 0,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const exempt = isWithinDutyFreeLimit(result.taxablePrice);
  const tariffRate = isWtoMember ? TARIFF_RATE_WTO : TARIFF_RATE_NON_WTO;
  const rateText = `${formatRate(exchangeRate)}円`;
  const taxableText = `課税価格 ${yen(result.taxablePrice)}円`;

  const lines: Line[] = [
    {
      key: "retail",
      label: "商品価格",
      amount: result.retailPriceInJpy,
      swatch: "bg-leaf",
      formula: [`${retailPrice.toLocaleString("ja-JP")} ${currency} × ${rateText}（1円未満切り捨て）`],
    },
    {
      key: "shipping",
      label: "送料",
      amount: result.shippingCostInJpy,
      swatch: "bg-sage",
      formula: [`${shippingCost.toLocaleString("ja-JP")} ${currency} × ${rateText}（1円未満切り捨て）`],
    },
    {
      key: "duty",
      label: "関税",
      amount: result.customsDuty,
      swatch: "bg-brass",
      formula: exempt
        ? [`${taxableText}が1万円以下のため免除`]
        : [
            `${yen(roundDownToNearest1000(result.taxablePrice))}円（課税価格を1,000円未満切り捨て）× ${percent(tariffRate)}`,
            "100円未満切り捨て",
          ],
    },
    {
      key: "tobacco",
      label: "たばこ税",
      amount: result.tobaccoTax,
      swatch: "bg-ember",
      formula: [`${weight.toLocaleString("ja-JP")} g × ${yen(TOBACCO_TAX_RATE)}円/kg`, "100円未満切り捨て。課税価格に関係なくかかります"],
    },
    {
      key: "consumption",
      label: "消費税",
      amount: result.consumptionTax,
      swatch: "bg-smoke",
      formula: exempt
        ? [`${taxableText}が1万円以下のため免除`]
        : [
            `${yen(roundDownToNearest1000(result.taxablePrice + result.customsDuty))}円（課税価格＋関税を1,000円未満切り捨て）× ${percent(CONSUMPTION_TAX_RATE)}`,
            "100円未満切り捨て",
          ],
    },
  ];

  const taxes = result.customsDuty + result.tobaccoTax + result.consumptionTax;
  const perGram = weight > 0 ? total / weight : 0;
  const thresholdFill = Math.min(1, result.taxablePrice / DUTY_FREE_LIMIT_JPY);

  return (
    <aside aria-labelledby="result-title" className="enter-late lg:col-span-5">
      <div className="lg:sticky lg:top-8">
        <div className="relative overflow-hidden rounded-[28px] bg-glass text-leaf shadow-[0_40px_80px_-40px_rgba(8,44,39,0.75)]">
          {/* glass sheen */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_70%_at_100%_0%,rgba(212,174,85,0.16),transparent_55%),radial-gradient(90%_60%_at_0%_100%,rgba(141,181,168,0.14),transparent_60%)]"
          />
          <div aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          {puffs > 0 && <Smoke key={puffs} />}

          <div className="relative p-6 sm:p-8">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="result-title" className="text-sm font-bold text-sage">
                支払い総額の目安
              </h2>
              {hasInput && weight > 0 && (
                <p className="num text-xs text-sage">1gあたり {yen(perGram)}円</p>
              )}
            </div>

            <div ref={totalRef} className="mt-3 flex items-baseline gap-2">
              <span
                className={`num text-[clamp(3.2rem,9vw,4.75rem)] font-bold leading-none tracking-[-0.035em] transition-colors duration-300 ${
                  hasInput ? "text-brass" : "text-glass-line"
                }`}
              >
                <Odometer value={total} />
              </span>
              <span className={`text-xl font-bold ${hasInput ? "text-brass" : "text-glass-line"}`}>円</span>
            </div>
            <p className="sr-only">{hasInput ? `${yen(total)}円` : "0円"}</p>
            <p className="sr-only" aria-live="polite">
              {hasInput ? `支払い総額の目安は${yen(announced)}円です` : ""}
            </p>

            <p className="mt-3 min-h-[1.5em] text-xs leading-relaxed text-sage">
              {hasInput
                ? taxes > 0
                  ? `うち税金 ${yen(taxes)}円`
                  : "税金はかかりません"
                : "商品価格と重量を入れると、ここに内訳が出ます"}
            </p>

            <Bar lines={lines} total={hasInput ? total : 0} />

            <ul className="mt-6 divide-y divide-glass-line border-y border-glass-line">
              {lines.map((line) => (
                <li key={line.key}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 rounded-md py-3.5 focus-visible:ring-brass focus-visible:ring-offset-glass [&::-webkit-details-marker]:hidden">
                      <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${line.swatch}`} />
                      <span className="flex-1 text-sm">{line.label}</span>
                      <span className={`num text-base font-semibold ${line.amount === 0 ? "text-sage/70" : ""}`}>
                        {hasInput ? `${yen(line.amount)}円` : "—"}
                      </span>
                      <Chevron className="h-4 w-4 shrink-0 text-sage transition-transform duration-200 group-open:rotate-180" />
                    </summary>
                    <div className="num pb-4 pl-[1.375rem] text-xs leading-[1.8] text-sage">
                      {line.formula.map((f) => (
                        <p key={f}>{f}</p>
                      ))}
                    </div>
                  </details>
                </li>
              ))}
            </ul>

            <div className="mt-6">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-sage">課税価格と少額免除ライン</span>
                <span className="num text-leaf">
                  {yen(hasInput ? result.taxablePrice : 0)} / {yen(DUTY_FREE_LIMIT_JPY)}円
                </span>
              </div>
              <div className="relative mt-2.5 h-1.5 rounded-full bg-glass-deep">
                <div
                  className={`h-full rounded-full transition-[width,background-color] duration-500 ease-out ${
                    exempt ? "bg-sage" : "bg-brass"
                  }`}
                  style={{ width: `${(hasInput ? thresholdFill : 0) * 100}%` }}
                />
              </div>
              <p className="mt-2.5 text-xs leading-relaxed text-sage">
                {!hasInput
                  ? `課税価格（商品価格×${TAXABLE_PRICE_RATIO}）が1万円以下なら、関税と消費税は免除されます。`
                  : exempt
                    ? "1万円以下のため、関税と消費税は免除で計算しています。"
                    : "1万円を超えたため、関税と消費税がかかります。"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <StickyTotal visible={hasInput && totalBelow} total={total} onJump={() => totalRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })} />
    </aside>
  );
}

function Bar({ lines, total }: { lines: Line[]; total: number }) {
  return (
    <div
      className="mt-6 flex h-3 overflow-hidden rounded-full bg-glass-deep"
      role="img"
      aria-label={
        total > 0
          ? `内訳: ${lines.filter((l) => l.amount > 0).map((l) => `${l.label} ${Math.round((l.amount / total) * 100)}%`).join("、")}`
          : "内訳はまだありません"
      }
    >
      {lines.map((line, i) => (
        <div
          key={line.key}
          className={`${line.swatch} h-full transition-[flex-grow,margin] duration-500 ease-out`}
          style={{
            flexGrow: total > 0 ? line.amount / total : 0,
            flexBasis: 0,
            minWidth: 0,
            marginLeft: line.amount > 0 && lines.slice(0, i).some((l) => l.amount > 0) ? 3 : 0,
          }}
        />
      ))}
    </div>
  );
}

function StickyTotal({ visible, total, onJump }: { visible: boolean; total: number; onJump: () => void }) {
  // Portaled to <body>: the panel's entrance animation makes it a containing block for fixed children.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div
      className={`fixed inset-x-3 bottom-3 z-20 transition-[transform,opacity] duration-300 ease-out lg:hidden ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-[130%] opacity-0"
      }`}
      aria-hidden={!visible}
    >
      <button
        type="button"
        onClick={onJump}
        tabIndex={visible ? 0 : -1}
        className="flex w-full items-center justify-between rounded-2xl bg-glass px-5 py-3.5 text-leaf shadow-[0_18px_40px_-16px_rgba(8,44,39,0.9)]"
      >
        <span className="text-sm text-sage">支払い総額の目安</span>
        <span className="flex items-center gap-2">
          <span className="num text-2xl font-bold tracking-tight text-brass">{yen(total)}円</span>
          <Chevron className="h-4 w-4 rotate-180 text-sage" />
        </span>
      </button>
    </div>,
    document.body
  );
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Each digit rolls to its new value; places are keyed from the right so they stay put as the number grows.
function Odometer({ value }: { value: number }) {
  const chars = yen(value).split("");
  return (
    <span aria-hidden className="inline-flex">
      {chars.map((c, i) => {
        const place = chars.length - i;
        if (!/\d/.test(c)) {
          return (
            <span key={`sep-${place}`} className="inline-block">
              {c}
            </span>
          );
        }
        const digit = Number(c);
        return (
          <span key={`d-${place}`} className="relative inline-block h-[1em] overflow-hidden">
            <span className="invisible">0</span>
            <span
              className="absolute inset-x-0 top-0 flex flex-col transition-transform duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
              style={{ transform: `translateY(-${digit * 10}%)`, transitionDelay: `${place * 35}ms` }}
            >
              {Array.from({ length: 10 }, (_, d) => (
                <span key={d} className="block h-[1em] text-center">
                  {d}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

function Smoke() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 140 200"
      fill="none"
      className="puff pointer-events-none absolute right-4 top-0 h-56 w-40 blur-[3px] sm:right-10"
    >
      <path pathLength={1} d="M70 200C48 170 92 150 70 118S46 70 74 40 66 8 80 0" stroke="#E6EEE9" strokeWidth="7" strokeLinecap="round" />
      <path pathLength={1} d="M92 200C76 176 108 160 96 132S80 96 100 70" stroke="#8DB5A8" strokeWidth="5" strokeLinecap="round" />
      <path pathLength={1} d="M52 200C40 182 64 164 54 140S40 112 56 92" stroke="#B9A3E3" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
