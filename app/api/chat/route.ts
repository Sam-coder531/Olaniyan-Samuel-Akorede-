import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "AI responses aren’t configured yet. Add OPENAI_API_KEY to the server environment to start chatting." }, { status: 503 });
  try {
    const { messages } = await request.json();
    if (!Array.isArray(messages) || messages.length > 100 || messages.some(m => !["user", "assistant"].includes(m.role) || typeof m.content !== "string" || m.content.length > 10000)) return NextResponse.json({ error: "Invalid conversation." }, { status: 400 });
    const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", messages }) });
    if (!response.ok) return NextResponse.json({ error: "The AI service couldn’t complete that request. Please try again later." }, { status: 502 });
    const data = await response.json();
    return NextResponse.json({ message: data.choices?.[0]?.message?.content || "No response was returned." });
  } catch { return NextResponse.json({ error: "Couldn’t process your request. Please try again." }, { status: 500 }); }
}
