import { ImageResponse } from "next/og";

export const alt = "FirstContact — Capital should travel further";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Static export: the OG image is rendered once at build time and written to
// disk, rather than generated per request.
export const dynamic = "force-static";

export default function Image() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#f2f0e9", color: "#10231c", padding: "66px 74px", fontFamily: "Helvetica, Arial, sans-serif" }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, letterSpacing: 3 }}><span style={{ fontWeight: 500 }}>FIRSTCONTACT</span><span>OPEN SOURCE / GLOBAL CAPITAL ACCESS</span></div><div style={{ display: "flex", flex: 1, alignItems: "center" }}><div style={{ display: "flex", flexDirection: "column", fontSize: 92, lineHeight: .95, letterSpacing: -6 }}><span>Capital should</span><span style={{ display: "flex" }}>travel&nbsp;<i>further.</i></span></div></div><div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #9aa59f", paddingTop: 24, fontSize: 19 }}><span>Context for capital. Agency for founders.</span><span style={{ background: "#c8fa52", padding: "12px 18px" }}>US · UK · EU · APAC</span></div></div>, size);
}
