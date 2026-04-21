import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#12CE90",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "7px",
        }}
      >
        {/* 2×2 grid matching the LayoutGrid icon in the header */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", width: "18px", height: "18px" }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: "7px",
                height: "7px",
                background: "#0d1f18",
                borderRadius: "1.5px",
              }}
            />
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
