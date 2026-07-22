import { internalMutation } from "./_generated/server";

export const applyRetentionPolicy = internalMutation({
  args: {},
  handler: async () => {
    // Intentionally conservative: implement deployment-specific deletion only after
    // the operator documents retention requirements and legal holds.
    return { status: "policy_required" };
  },
});
