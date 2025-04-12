import { useState } from "react";
import { 
  roundDownToNearest1000,
  calculateTariffInJpy,
  CalculationResult,
  calculateTaxablePriceInJpy,
  calculateTobaccoTaxInJpy,
  calculateConsumptionTaxInJpy,
  calculateInJpy,
  calculateTotalAmountInJpy
} from "~/utils/calculation";

import type { MetaFunction, LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export const meta: MetaFunction = () => {
  return [
    { title: "Shisha Tariff Calculator for Japan" },
    { name: "description", content: "Shisha Tariff Calculator for Japan" },
  ];
};

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const currency = url.searchParams.get("currency") || "USD";
  
  try {
    const response = await fetch(
      `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/latest/${currency}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("為替レートの取得に失敗しました:", error);
    return { "error": "為替レートの取得に失敗しました" ,  "status": 500 };
  }
};

export default function Index() {
  const exchangeRates = useLoaderData<typeof loader>();
  const [formData, setFormData] = useState({
    retailPrice: "",
    shippingCost: "",
    weight: "",
    currency: "USD",
    isWtoMember: true,
  });
  const [result, setResult] = useState<CalculationResult | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prevData => ({
      ...prevData,
      [name]: newValue,
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      if (exchangeRates.error) {
        throw new Error(exchangeRates.error);
      }
      
      const retailPrice = parseFloat(formData.retailPrice);
      const retailPriceInJpy = calculateInJpy(retailPrice, exchangeRates.conversion_rates.JPY);
      const shippingCost = parseFloat(formData.shippingCost);
      const weight = parseFloat(formData.weight);
      const isWtoMember = formData.isWtoMember;
      const exchangeRate = exchangeRates.conversion_rates.JPY;
      
      const taxablePriceInJpy = calculateTaxablePriceInJpy(retailPrice, exchangeRate);
      const customsDutyInJpy = calculateTariffInJpy(taxablePriceInJpy, isWtoMember);
      const tobaccoTaxInJpy = calculateTobaccoTaxInJpy(weight);
      const consumptionTaxInJpy = calculateConsumptionTaxInJpy(taxablePriceInJpy, customsDutyInJpy);
      const shippingCostInJpy = calculateInJpy(shippingCost, exchangeRate);
      const totalAmountInJpy = calculateTotalAmountInJpy(retailPriceInJpy, customsDutyInJpy, tobaccoTaxInJpy, consumptionTaxInJpy, shippingCostInJpy);

      const calculatedResult: CalculationResult = {
        retailPrice: retailPrice,
        retailPriceInJpy: retailPriceInJpy,
        taxablePrice: taxablePriceInJpy,
        customsDuty: customsDutyInJpy,
        tobaccoTax: tobaccoTaxInJpy,
        consumptionTax: consumptionTaxInJpy,
        shippingCostInJpy: shippingCostInJpy,
        totalAmount: totalAmountInJpy,
      };
      setResult(calculatedResult);
    } catch (error) {
      console.error("為替レートの取得に失敗しました:", error);
      alert("為替レートの取得に失敗しました。もう一度お試しください。");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 text-center mb-12">Shisha Tariff Calculator for Japan</h1>
        
        <div className="bg-white shadow-xl rounded-lg p-6 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">小売価格</label>
                <div className="relative">
                  <input
                    type="number"
                    name="retailPrice"
                    value={formData.retailPrice}
                    onChange={handleChange}
                    className="block w-full px-4 pr-16 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  />
                  <span className="absolute right-3 top-3 text-gray-500">{formData.currency}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">送料</label>
                <div className="relative">
                  <input
                    type="number"
                    name="shippingCost"
                    value={formData.shippingCost}
                    onChange={handleChange}
                    className="block w-full px-4 pr-16 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  />
                  <span className="absolute right-3 top-3 text-gray-500">{formData.currency}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">重量</label>
                <div className="relative">
                  <input
                    type="number"
                    name="weight"
                    value={formData.weight}
                    onChange={handleChange}
                    className="block w-full px-4 pr-16 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  />
                  <span className="absolute right-3 top-3 text-gray-500">g</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">通貨</label>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  className="block w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value="USD">USD (米ドル)</option>
                  <option value="EUR">EUR (ユーロ)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                name="isWtoMember"
                checked={formData.isWtoMember}
                onChange={handleChange}
                className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-colors"
              />
              <label className="ml-2 block text-sm font-medium text-gray-700">WTO加盟国</label>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              計算する
            </button>
          </form>
        </div>

        {result && (
          <div className="bg-white shadow-xl rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">計算結果</h2>
            <div className="space-y-4">

              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-600">為替レート (1{formData.currency}):</span>
                <span className="text-lg font-medium">{exchangeRates?.conversion_rates.JPY.toLocaleString()} 円</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-600">小売価格:</span>
                <span className="text-lg font-medium">{result.retailPriceInJpy.toLocaleString()} 円</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-600">課税価格:</span>
                <span className="text-lg font-medium">{result.taxablePrice.toLocaleString()} 円</span>
              </div>
              <div className="text-sm text-gray-500 mb-2">
                <div>計算式:</div>
                <div>小売価格 {formData.retailPrice}{formData.currency} × 為替レート {exchangeRates?.conversion_rates.JPY} × 0.6</div>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-600">関税:</span>
                <span className="text-lg font-medium">{result.customsDuty.toLocaleString()} 円</span>
              </div>
              <div className="text-sm text-gray-500 mb-2">
                <div>計算式:</div>
                <div>課税価格(1,000円未満切り捨て) {roundDownToNearest1000(result.taxablePrice).toLocaleString()} 円 × {formData.isWtoMember ? '29.8%' : '35%'}</div>
                <div>100円未満切り捨て</div>
                <div>課税価格10,000円未満の場合非課税</div>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-600">タバコ税:</span>
                <span className="text-lg font-medium">{result.tobaccoTax.toLocaleString()} 円</span>
              </div>
              <div className="text-sm text-gray-500 mb-2">
                <div>計算式:</div>
                <div>重量 {formData.weight}g × 15,244円/1000g</div>
                <div>100円未満切り捨て</div>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-600">消費税:</span>
                <span className="text-lg font-medium">{result.consumptionTax.toLocaleString()} 円</span>
              </div>
              <div className="text-sm text-gray-500 mb-2">
                <div>計算式:</div>
                <div>(課税価格 {result.taxablePrice.toLocaleString()} 円
                  + 関税 {result.customsDuty.toLocaleString()} 円 (1,000円未満切り捨て))
                  × 10%</div>
                <div>100円未満切り捨て</div>
                <div>課税価格10,000円未満の場合非課税</div>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-600">送料:</span>
                <span className="text-lg font-medium">{result.shippingCostInJpy.toLocaleString()} 円</span>
              </div>
              <div className="flex justify-between items-center py-3 mt-2">
                <span className="text-lg font-bold text-gray-900">合計金額:</span>
                <span className="text-2xl font-bold text-blue-600">{result.totalAmount.toLocaleString()} 円</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}