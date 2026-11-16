"use client";

import { useState } from "react";

type State = "idle" | "sending" | "ok" | "err";

export default function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [note, setNote] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "sending") return;

    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      setState("err");
      setNote("That email doesn't look right.");
      return;
    }

    setState("sending");
    setNote("Saving your spot…");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok || !data.ok) {
        setState("err");
        setNote(data.error ?? "Couldn't save that. Try again?");
        return;
      }

      setState("ok");
      setNote("You're on the list. We'll be in touch.");
      setEmail("");
    } catch {
      setState("err");
      setNote("Network hiccup — try once more.");
    }
  }

  return (
    <>
      <form className="form" onSubmit={submit} noValidate>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-label="Email address"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state !== "sending") {
              setState("idle");
              setNote("");
            }
          }}
        />
        <button className="cta cta--solid" type="submit" disabled={state === "sending"}>
          {state === "sending" ? "Saving…" : "Reserve yours"}
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 12h13m0 0-5-5m5 5-5 5"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </form>
      <p className="note" data-state={state === "ok" ? "ok" : state === "err" ? "err" : undefined} role="status">
        {note}
      </p>
    </>
  );
}
