import { ImageResponse } from "next/og";

import { SITE_NAME, SITE_TAGLINE } from "../lib/site-config";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background:
            "linear-gradient(135deg, #0f2119 0%, #182b22 58%, #214235 100%)",
          color: "#fbfdfb",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "18px",
            fontSize: 26,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#7fe7bd",
          }}
        >
          Kidario
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          <div
            style={{
              fontSize: 86,
              lineHeight: 0.95,
              letterSpacing: "-0.06em",
              maxWidth: "860px",
            }}
          >
            {SITE_TAGLINE}
          </div>
          <div
            style={{
              fontSize: 30,
              lineHeight: 1.4,
              maxWidth: "780px",
              color: "rgba(251,253,251,0.82)",
            }}
          >
            Famílias e educadores em uma experiência mais clara de aprendizagem
            personalizada.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 24,
            color: "rgba(251,253,251,0.72)",
          }}
        >
          <span>{SITE_NAME}</span>
          <span>kidario.app</span>
        </div>
      </div>
    ),
    size,
  );
}
