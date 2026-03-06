import { ImageResponse } from "next/og";

export const alt = "Onbure";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          height: "100%",
          width: "100%",
          background:
            "linear-gradient(135deg, #081225 0%, #102445 52%, #f97316 100%)",
          color: "#f8fafc",
          padding: "64px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            border: "1px solid rgba(248, 250, 252, 0.22)",
            borderRadius: "32px",
            padding: "48px",
            background: "rgba(8, 18, 37, 0.34)",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            Onbure
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              maxWidth: "860px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 78,
                fontWeight: 800,
                lineHeight: 1.05,
              }}
            >
              Collaboration for modern product teams.
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 32,
                lineHeight: 1.35,
                color: "#dbeafe",
              }}
            >
              Discover teammates, manage requests, and coordinate work in one platform.
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
