import type { Investor, Match, StartupProfile } from "./domain";

const normalize = (value: string) => value.trim().toLowerCase();

export function scoreInvestor(profile: StartupProfile, investor: Investor): Match {
  const profileSectors = new Set(profile.sectors.map(normalize));
  const sectorHits = investor.sectors.filter((sector) => profileSectors.has(normalize(sector)));
  const stageHit = investor.stages.map(normalize).includes(normalize(profile.stage));
  const geographyText = investor.geographies.join(" ").toLowerCase();
  const geographyHit = geographyText.includes(profile.region.toLowerCase()) || geographyText.includes("emerging");
  const targetRegionHit = profile.targetRegions.includes(investor.region);
  const score = Math.min(100, 30 + sectorHits.length * 15 + (stageHit ? 20 : 0) + (geographyHit ? 20 : 0) + (targetRegionHit ? 10 : 0));
  const reasons = [
    ...(geographyHit ? ["Geography mandate overlap"] : []),
    ...(stageHit ? ["Stage overlap"] : []),
    ...(sectorHits.length ? [`Sector overlap: ${sectorHits.join(", ")}`] : []),
    ...(targetRegionHit ? [`Target capital region: ${investor.region}`] : []),
  ];
  const risks = [
    ...(!geographyHit ? ["No explicit geography evidence"] : []),
    ...(!stageHit ? ["Stage is not explicitly listed"] : []),
    ...(!sectorHits.length ? ["Sector fit needs human review"] : []),
  ];
  return { ...investor, score, reasons, risks };
}
