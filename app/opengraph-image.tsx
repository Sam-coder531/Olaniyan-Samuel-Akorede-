import { ImageResponse } from "next/og";

export const alt = "UNFINISHED ∞ — a painting no one will finish";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#08080a",
          padding: 72,
          position: "relative",
          fontFamily: "serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(38% 46% at 66% 42%, rgba(91,140,255,0.20), rgba(8,8,10,0) 70%), radial-gradient(30% 34% at 32% 66%, rgba(176,123,255,0.14), rgba(8,8,10,0) 72%)",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ fontSize: 40, color: "#f2ede3", lineHeight: 1 }}>∞</div>
          <div
            style={{
              fontSize: 22,
              letterSpacing: 10,
              color: "#f2ede3",
              textTransform: "uppercase",
            }}
          >
            Unfinished
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ width: 120, height: 1, background: "rgba(242,237,227,0.35)", marginBottom: 34 }} />
          <div
            style={{
              fontSize: 74,
              lineHeight: 1.04,
              letterSpacing: -2,
              color: "#f2ede3",
              maxWidth: 900,
              display: "flex",
            }}
          >
            A painting no one will ever finish.
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 25,
              lineHeight: 1.5,
              color: "rgba(242,237,227,0.55)",
              maxWidth: 760,
              display: "flex",
            }}
          >
            The machine started it. Every visitor adds permanent ink, live. Replay every stroke since
            the first one.
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 18, letterSpacing: 4, color: "rgba(242,237,227,0.4)", textTransform: "uppercase" }}>
            drag to paint · nothing is ever erased
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: 8, background: "#ff5a36" }} />
            <div style={{ fontSize: 18, letterSpacing: 4, color: "rgba(242,237,227,0.4)", textTransform: "uppercase" }}>
              live
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
