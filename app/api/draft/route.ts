import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

const inputSchema = z.object({
  founder: z.object({ name: z.string(), organization: z.string(), oneLiner: z.string(), traction: z.string(), context: z.string() }),
  investor: z.object({ firm: z.string(), thesis: z.string(), evidence: z.array(z.string()), sourceUrl: z.string().url() }),
});

export async function POST(request: Request) {
  const input = inputSchema.safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: "Invalid drafting context", issues: input.error.flatten() }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ mode: "preview", draft: { subject: `${input.data.founder.organization} × ${input.data.investor.firm}`, body: "Connect OpenAI to create an evidence-constrained draft. This preview intentionally does not fabricate one.", claimsToVerify: [] } });

  try {
    const response = await new OpenAI({ apiKey: process.env.OPENAI_API_KEY }).responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5-nano",
      instructions: "Draft a concise founder-to-investor introduction. Use only supplied facts. Never invent metrics, relationships, portfolio facts, or contact details. Be direct and specific. Return JSON matching the schema.",
      input: JSON.stringify(input.data),
      text: { format: { type: "json_schema", name: "outreach_draft", strict: true, schema: { type: "object", additionalProperties: false, properties: { subject: { type: "string" }, body: { type: "string" }, claimsToVerify: { type: "array", items: { type: "string" } } }, required: ["subject", "body", "claimsToVerify"] } } },
    });
    return NextResponse.json({ mode: "live", draft: response.output_text ? JSON.parse(response.output_text) : null, requiresHumanApproval: true });
  } catch { return NextResponse.json({ error: "Drafting provider failed" }, { status: 502 }); }
}
