import type { LoaderFunction } from "@remix-run/node";

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