import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "GEMINI_API_KEY تنظیم نشده" },
        { status: 500 }
      );
    }

    // ✅ مدل کم مصرف‌تر برای جلوگیری از 429
    const model = "gemini-flash-lite-latest";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const data = await response.json();

    // ✅ هندل Rate Limit (429)
    if (response.status === 429) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "سهمیه Gemini فعلاً پر شده 😅 لطفاً ۲ تا ۵ دقیقه بعد دوباره امتحان کن.",
          googleError: data,
        },
        { status: 429 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, status: response.status, googleError: data },
        { status: 500 }
      );
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    return NextResponse.json({
      ok: true,
      text: text || "پاسخی دریافت نشد",
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Gemini fetch failed", details: String(e) },
      { status: 500 }
    );
  }
}
