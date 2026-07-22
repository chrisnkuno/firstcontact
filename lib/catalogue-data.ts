export type CatalogueProfile = {
  id: string;
  name: string;
  type: "Startup" | "Institution";
  location: string;
  region: "Africa" | "Latin America" | "MENA" | "South Asia" | "Southeast Asia";
  stage: "Pre-seed" | "Seed" | "Series A" | "Growth" | "Institutional";
  sectors: string[];
  oneLiner: string;
  context: string;
  strengths: string[];
  considerations: string[];
  traction: string;
  raise: string;
  instrument: string;
  verified: string;
  accent: string;
};

// Fictional profiles for the public catalogue preview. Production records must
// be founder-approved and backed by private Convex state and source evidence.
export const catalogueProfiles: CatalogueProfile[] = [
  { id: "kivu-grid", name: "Kivu Grid", type: "Startup", location: "Kigali, Rwanda", region: "Africa", stage: "Seed", sectors: ["Climate", "Energy"], oneLiner: "Energy intelligence that helps African commercial buildings reduce cost and diesel dependence.", context: "Built for grids where outages, generator use, and fragmented equipment data make conventional energy software incomplete.", strengths: ["20 paid operating sites", "Ten years of regional infrastructure experience", "Measured cost and carbon baseline"], considerations: ["Enterprise sales cycles remain long", "Hardware financing partner still needed"], traction: "20 paid sites · 12 months measured data", raise: "$1.5M", instrument: "Equity", verified: "Founder verified · Jul 2026", accent: "#c8fa52" },
  { id: "marea-health", name: "Marea Health", type: "Startup", location: "Cartagena, Colombia", region: "Latin America", stage: "Pre-seed", sectors: ["Health", "Logistics"], oneLiner: "Coordinated diagnostic delivery for coastal and rural clinics that lose patients between referral and result.", context: "The operating model combines local courier networks with lightweight clinical coordination where formal addressing is inconsistent.", strengths: ["Three clinic groups piloting", "Clinical and logistics founding team", "Designed around existing care workflows"], considerations: ["Early revenue evidence", "Country-by-country health regulation"], traction: "3 pilots · 1,800 patient journeys mapped", raise: "$650K", instrument: "SAFE", verified: "Founder verified · Jul 2026", accent: "#f0a95d" },
  { id: "atlas-water", name: "Atlas Water Cooperative", type: "Institution", location: "Ouarzazate, Morocco", region: "MENA", stage: "Institutional", sectors: ["Water", "Climate"], oneLiner: "A regional cooperative financing solar-powered water resilience for agricultural communities.", context: "Community governance and seasonal cash flows require blended capital rather than conventional venture-only terms.", strengths: ["42 member communities", "Municipal implementation agreements", "Seven-year operating record"], considerations: ["Requires blended-finance structure", "Returns tied to long-duration infrastructure"], traction: "42 communities · 18 active sites", raise: "$4M", instrument: "Blended finance", verified: "Institution verified · Jun 2026", accent: "#7dd7cd" },
  { id: "nadi-ledger", name: "Nadi Ledger", type: "Startup", location: "Dhaka, Bangladesh", region: "South Asia", stage: "Series A", sectors: ["Fintech", "Commerce"], oneLiner: "Working-capital intelligence for small manufacturers selling through fragmented regional supply chains.", context: "Underwriting uses verified order and fulfillment history instead of requiring the collateral most small suppliers cannot provide.", strengths: ["$18M annualized transaction volume", "Positive contribution margin", "Embedded distribution partnerships"], considerations: ["Concentration in two buyer networks", "Credit facility expansion required"], traction: "$18M ATV · 2,400 suppliers", raise: "$6M", instrument: "Equity + debt", verified: "Founder verified · Jul 2026", accent: "#aab7ff" },
  { id: "isla-circular", name: "Isla Circular", type: "Startup", location: "Cebu, Philippines", region: "Southeast Asia", stage: "Seed", sectors: ["Climate", "Materials"], oneLiner: "Traceable recovery and preprocessing for flexible plastics across island economies.", context: "Island logistics make centralized recycling uneconomic; modular preprocessing changes transport density before material moves.", strengths: ["Two contracted off-takers", "Municipal collection partnerships", "Traceability at batch level"], considerations: ["Asset-heavy regional expansion", "Commodity price exposure"], traction: "380 tonnes processed · 2 off-takers", raise: "$2.2M", instrument: "Equity", verified: "Founder verified · Jul 2026", accent: "#f2d56b" },
  { id: "sahel-learning", name: "Sahel Learning Network", type: "Institution", location: "Dakar, Senegal", region: "Africa", stage: "Growth", sectors: ["Education", "Infrastructure"], oneLiner: "Teacher-led offline learning infrastructure for low-connectivity secondary schools.", context: "The network treats curriculum, teacher support, and local device maintenance as one system rather than a software rollout.", strengths: ["126 schools active", "Government-aligned curriculum", "Three-year retention data"], considerations: ["Procurement timing is seasonal", "Grant-to-revenue transition underway"], traction: "126 schools · 38,000 learners", raise: "$3M", instrument: "Program-related investment", verified: "Institution verified · May 2026", accent: "#d1a7e8" },
];
