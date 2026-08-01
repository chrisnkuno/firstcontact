import type { CampaignStatus, OrganizationRole } from "./domain";

export type CampaignAction = "edit" | "request_review" | "approve" | "start" | "pause" | "resume" | "complete";

const allowedRoles: Record<CampaignAction, readonly OrganizationRole[]> = {
  edit: ["owner", "member"],
  request_review: ["owner", "member"],
  approve: ["owner", "reviewer"],
  start: ["owner"],
  pause: ["owner"],
  resume: ["owner"],
  complete: ["owner"],
};

const transitions: Record<CampaignAction, readonly CampaignStatus[]> = {
  edit: ["draft"],
  request_review: ["draft"],
  approve: ["review"],
  start: ["approved"],
  pause: ["running"],
  resume: ["paused"],
  complete: ["running", "paused"],
};

export function canPerformCampaignAction(role: OrganizationRole, status: CampaignStatus, action: CampaignAction) {
  return allowedRoles[action].includes(role) && transitions[action].includes(status);
}

export function campaignStatusAfter(action: Exclude<CampaignAction, "edit">): CampaignStatus {
  return {
    request_review: "review",
    approve: "approved",
    start: "running",
    pause: "paused",
    resume: "running",
    complete: "complete",
  }[action] as CampaignStatus;
}
