// AI statement reader for the cost comparison "Scan Statement" feature.
//
// POST /api/scan-statement  { files: [{ name, media_type, data (base64) }] }
//   → { ok: true, result: {...normalized statement...}, model }
// GET  /api/scan-statement  → { configured: boolean } (lets the page decide which engine to use)
//
// The page falls back to its on-device reader whenever this endpoint is unavailable,
// not configured (no ANTHROPIC_API_KEY), or fails.
import Anthropic from "@anthropic-ai/sdk";
import type { Config, Context } from "@netlify/functions";

const MAX_BODY_BYTES = 5_900_000; // Netlify synchronous functions accept ~6 MB request bodies
const MAX_FILES = 20;
const PDF_TYPE = "application/pdf";
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const DEFAULT_MODEL = "claude-opus-5";
// Netlify stops synchronous functions at 60 s; leave headroom to return a clean error.
const REQUEST_TIMEOUT_MS = 50_000;

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });
const num = nullable({ type: "number" });
const int = nullable({ type: "integer" });
const str = nullable({ type: "string" });

const STATEMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "is_statement", "merchant_name", "legal_name", "address", "mid", "processor", "statement_period", "volume", "refunds",
    "transactions", "transactions_derived", "total_fees", "fee_breakdown", "card_mix", "interchange_lines", "notes", "confidence",
  ],
  properties: {
    is_statement: { type: "boolean", description: "False when the files are not a merchant card-processing statement (e.g. an ID, a check, a receipt, a bank statement)." },
    merchant_name: { ...str, description: "Business/DBA name customers know. Never the owner's personal name or the processor." },
    legal_name: { ...str, description: "Legal entity name when different from merchant_name (e.g. an LLC)." },
    address: {
      type: "object",
      additionalProperties: false,
      required: ["street", "city", "state", "zip"],
      properties: { street: str, city: str, state: str, zip: str },
    },
    mid: { ...str, description: "Merchant number / MID as printed (may be masked)." },
    processor: { ...str, description: "Company that issued the statement (processor or ISO)." },
    statement_period: { ...str, description: "Statement period or processing month as printed." },
    volume: { ...num, description: "Total card sales volume for the period, in dollars." },
    refunds: { ...num, description: "Total refunds/credits for the period, in dollars (positive number)." },
    transactions: { ...int, description: "Number of sales transactions for the period." },
    transactions_derived: { type: "boolean", description: "True when transactions was computed (e.g. volume ÷ average ticket) rather than printed." },
    total_fees: { ...num, description: "Total of ALL processing fees the merchant paid for the period, in dollars." },
    fee_breakdown: {
      type: "object",
      additionalProperties: false,
      required: ["interchange", "card_brand_fees", "processor_fees"],
      properties: {
        interchange: { ...num, description: "Interchange/pass-through total if the statement shows it." },
        card_brand_fees: { ...num, description: "Card brand assessments / network fees total if shown." },
        processor_fees: { ...num, description: "Processor markup, discount, and service fees total if shown." },
      },
    },
    card_mix: {
      type: "array",
      description: "Sales volume and count by card brand and type.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["brand", "type", "volume", "count"],
        properties: {
          brand: { type: "string", enum: ["visa", "mastercard", "discover", "amex", "pin_debit", "ebt", "other"] },
          type: { type: "string", enum: ["credit", "debit", "unknown"] },
          volume: { type: "number" },
          count: int,
        },
      },
    },
    interchange_lines: {
      type: "array",
      description: "Itemized interchange programs, only when the statement lists them. At most 40 rows (largest volume first).",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["brand", "type", "name", "volume", "count", "rate_pct", "per_item", "fee"],
        properties: {
          brand: { type: "string", enum: ["visa", "mastercard", "discover"] },
          type: { type: "string", enum: ["credit", "debit"] },
          name: { type: "string", description: "Interchange program name exactly as printed." },
          volume: { type: "number" },
          count: int,
          rate_pct: { ...num, description: "Charged percentage, e.g. 0.0165 or .0165 on the statement → 1.65." },
          per_item: { ...num, description: "Charged per-item fee in dollars, e.g. 0.10." },
          fee: { ...num, description: "Interchange dollars charged for this program." },
        },
      },
    },
    notes: { type: "array", items: { type: "string" }, description: "Short notes an agent should know (zero volume, rebates, missing pages, estimates)." },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
} as const;

const SYSTEM_PROMPT = `You read merchant credit card processing statements for a payments sales team that prepares cost comparisons. Extract the facts exactly as the statement shows them; the numbers feed a savings proposal, so accuracy matters more than completeness. Use null for anything the statement does not show rather than guessing.

How to read the key totals:
- volume: the total card sales submitted for the statement period (labels such as "Amounts Submitted", "Total Gross Sales", "Total Sales", "Plan Summary" totals, or the card-type summary total). Use gross sales before refunds, and report refunds separately.
- transactions: the number of sales transactions/items for the period. If only an average ticket is printed, compute volume ÷ average ticket, round it, and set transactions_derived to true.
- total_fees: everything the merchant paid to accept cards for this period — discount/processing fees (including fees deducted daily), interchange and pass-through, card brand/network fees, and monthly, service, PCI, statement, gateway, and equipment fees. Prefer the statement's own total ("Fees Charged", "Total Fees", "Total Monthly Fees", "Amount Total", "Total Charges and Fees"). When a statement splits "Discount Due" and "Fees Due", add them together. If only the summary page is present and it shows the month-end "Amount Deducted" but no fee totals, use that amount and say so in notes. Do not count chargeback or refund amounts, loan/capital repayments, or taxes as fees. If the statement shows rebates or credits against fees, keep total_fees as the gross amount charged and mention the net figure in notes.
- card_mix: one row per card brand and credit/debit type from the card-type or plan-code summary (VS/VD/MC/MD/DS/AM style codes count). PIN debit networks (Interlink, STAR, Pulse, Accel, Maestro, NYCE) go under pin_debit. Use type "unknown" when the statement does not separate credit from debit for a brand.
- interchange_lines: only when the statement itemizes interchange programs (for example "VI-CPS/RETAIL ALL OTHER (DB)", "MC-WORLD ELITE MERIT III", "Retail Product 2 Signature Preferred"). Copy each program name exactly. Convert decimal rates to percent (0.0165 → 1.65). Leave this empty for flat-rate or tiered statements.

Merchant identity: merchant_name is the business the customer knows (the DBA or location name). Statements often print an owner or contact person above or below the business name — never use a person's name as merchant_name. The address is the merchant's business location; prefer a "Location" address over a mailing address or PO box when both appear, and never use the processor's or ISO's address.

Several files, or several photos, are pages of one statement: combine them. Agents often photograph pages with a phone, so photos can be skewed, shaded, out of order, or include the same page twice — combine them without double counting, read what is legible, and lower confidence if a key total is hard to read or its page is missing. Report only what the pages show; if the summary page was not photographed, leave those totals null rather than rebuilding them from partial detail.

If the files are not a merchant card-processing statement (for example a driver's license, a check, a receipt, or a bank statement), set is_statement to false, leave every other field null or empty, and name the kind of document in notes. Never transcribe personal identifiers such as license, account, routing, or Social Security numbers.`;

type IncomingFile = { name?: string; media_type?: string; data?: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function fail(status: number, code: string, error: string) {
  return json({ ok: false, code, error }, status);
}

type Extracted = {
  merchant_name: string | null;
  legal_name: string | null;
  address: { street: string | null; city: string | null; state: string | null; zip: string | null };
  [key: string]: unknown;
};

// Shape the model output into the same result object the on-device reader produces.
function normalize(data: Extracted) {
  const a = data.address || { street: null, city: null, state: null, zip: null };
  const cityLine = [a.city, [a.state, a.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const address = [a.street, cityLine].filter(Boolean).join(", ") || null;
  return { ...data, source: "ai", address, address_parts: a };
}

export default async (req: Request, _context: Context) => {
  const apiKey = Netlify.env.get("ANTHROPIC_API_KEY");
  const model = Netlify.env.get("ANTHROPIC_MODEL") || DEFAULT_MODEL;

  if (req.method === "GET") return json({ configured: Boolean(apiKey) });
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Use POST.");
  if (!apiKey) return fail(501, "not_configured", "AI scanning is not configured on this site (ANTHROPIC_API_KEY is not set).");

  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_BODY_BYTES) return fail(413, "too_large", "The statement is too large to upload. Try fewer pages or a smaller scan.");

  let files: IncomingFile[];
  try {
    const body = (await req.json()) as { files?: IncomingFile[] };
    files = Array.isArray(body.files) ? body.files : [];
  } catch {
    return fail(400, "bad_request", "The request body must be JSON.");
  }
  if (!files.length) return fail(400, "bad_request", "No statement files were sent.");
  if (files.length > MAX_FILES) return fail(400, "bad_request", `Send at most ${MAX_FILES} pages at a time.`);

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const f of files) {
    const data = typeof f.data === "string" ? f.data.replace(/\s+/g, "") : "";
    if (!data || !/^[A-Za-z0-9+/]+=*$/.test(data)) return fail(400, "bad_request", "A file could not be read.");
    if (f.media_type === PDF_TYPE) {
      content.push({ type: "document", source: { type: "base64", media_type: PDF_TYPE, data } });
    } else if (f.media_type && IMAGE_TYPES.has(f.media_type)) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: f.media_type as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data },
      });
    } else {
      return fail(415, "unsupported_type", "Only PDF statements and photos (JPEG, PNG, WebP) can be scanned.");
    }
  }
  content.push({
    type: "text",
    text: files.length > 1
      ? `These ${files.length} files are pages of one merchant processing statement. Extract the statement details.`
      : "Extract the details from this merchant processing statement.",
  });

  const client = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 });
  const started = Date.now();
  try {
    const stream = client.beta.messages.stream({
      model,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: {
        effort: (Netlify.env.get("SCAN_EFFORT") as "low" | "medium" | "high" | undefined) || "low",
        format: { type: "json_schema", schema: STATEMENT_SCHEMA as unknown as Record<string, unknown> },
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    });
    const message = await stream.finalMessage();
    console.log(`scan-statement: ${files.length} file(s), ${Date.now() - started} ms, stop=${message.stop_reason}, in=${message.usage.input_tokens} out=${message.usage.output_tokens}`);

    if (message.stop_reason === "refusal") return fail(422, "refused", "The AI reader declined this file. Use the on-device reader or enter the numbers manually.");
    if (message.stop_reason === "max_tokens") return fail(502, "incomplete", "The statement was too long to read in one pass. Try uploading just the summary pages.");
    const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    let data: Extracted;
    try {
      data = JSON.parse(text) as Extracted;
    } catch {
      return fail(502, "bad_output", "The AI reader returned an unreadable result. Try again.");
    }
    return json({ ok: true, model: message.model, result: normalize(data) });
  } catch (err) {
    const detail = err instanceof Anthropic.APIError ? `${err.constructor.name} ${err.status ?? ""}` : err instanceof Error ? err.constructor.name : "unknown";
    console.error(`scan-statement failed after ${Date.now() - started} ms: ${detail}`);
    if (err instanceof Anthropic.APIConnectionTimeoutError) return fail(504, "timeout", "The AI reader took too long. Try uploading just the summary pages.");
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return fail(500, "auth", "The site's Anthropic API key was rejected.");
    if (err instanceof Anthropic.RateLimitError) return fail(429, "rate_limited", "The AI reader is busy. Wait a moment and try again.");
    if (err instanceof Anthropic.BadRequestError) return fail(400, "rejected", "The AI reader could not open this file. Try a clearer photo or the original PDF.");
    if (err instanceof Anthropic.APIConnectionError) return fail(502, "network", "Could not reach the AI reader. Try again.");
    if (err instanceof Anthropic.APIError) return fail(502, "upstream", `The AI reader returned an error (${err.status ?? "unknown"}).`);
    return fail(500, "internal", "Unexpected error while reading the statement.");
  }
};

export const config: Config = {
  path: "/api/scan-statement",
};
