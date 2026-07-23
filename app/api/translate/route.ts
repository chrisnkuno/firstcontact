import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { supportedLanguages } from "@/lib/languages";

export const dynamic = "force-dynamic";

const languageCodes = supportedLanguages.map((language) => language.code) as [string, ...string[]];

const inputSchema = z.object({
  texts: z.array(z.string().trim().min(1).max(600)).min(1).max(80),
  target: z.enum(languageCodes),
});

// Automated, best-effort UI translation so founders and investors who don't
// read English can still use the product. Without OPENAI_API_KEY this
// intentionally echoes the original text back untranslated rather than
// fabricating a translation.
export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid translation request" }, { status: 400 });
  }

  const { texts, target } = parsed.data;

  if (target === "en") {
    return NextResponse.json({ mode: "identity", translated: false, translations: texts });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ mode: "preview", translated: false, translations: texts });
  }

  const language = supportedLanguages.find((entry) => entry.code === target);

  try {
    const response = await new OpenAI({ apiKey: process.env.OPENAI_API_KEY }).responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5-nano",
      instructions: `Translate each string in the input array into ${language?.label ?? target} (${language?.nativeLabel ?? target}). Keep the same order and count as the input. Preserve numbers, product names like "FirstContact", and placeholders exactly. Keep the tone concise and natural for interface copy. Return only the translations array, no commentary.`,
      input: JSON.stringify({ texts }),
      text: {
        format: {
          type: "json_schema",
          name: "ui_translations",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: { translations: { type: "array", items: { type: "string" } } },
            required: ["translations"],
          },
        },
      },
    });

    const parsedOutput = response.output_text ? JSON.parse(response.output_text) : null;
    const translations: unknown = parsedOutput?.translations;

    if (!Array.isArray(translations) || translations.length !== texts.length) {
      return NextResponse.json({ mode: "preview", translated: false, translations: texts });
    }

    return NextResponse.json({ mode: "live", translated: true, translations });
  } catch {
    return NextResponse.json({ mode: "preview", translated: false, translations: texts });
  }
}
