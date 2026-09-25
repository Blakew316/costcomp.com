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

// Money in one bank-statement category, with who it went to or came from
const bankGroup = (description: string) => ({
  type: "object",
  additionalProperties: false,
  required: ["total", "count", "sources"],
  description,
  properties: {
    total: { type: "number", description: "Sum over all months covered, in dollars (positive)." },
    count: { type: "integer" },
    sources: {
      type: "array",
      description: "Totals by processor, vendor, or funder (names only — no account or reference numbers).",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "total", "count"],
        properties: { name: { type: "string" }, total: { type: "number" }, count: { type: "integer" } },
      },
    },
  },
});

const STATEMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "is_statement", "document_type", "bank", "merchant_name", "legal_name", "address", "mid", "processor", "statement_period", "volume", "refunds",
    "transactions", "transactions_derived", "total_fees", "fee_breakdown", "card_mix", "interchange_lines", "notes", "confidence",
  ],
  properties: {
    is_statement: { type: "boolean", description: "True for a merchant card-processing statement or a business/personal bank account statement. False for anything else (an ID, a check, a receipt, a credit card bill)." },
    document_type: { type: "string", enum: ["processing_statement", "bank_statement", "other"] },
    bank: nullable({
      type: "object",
      additionalProperties: false,
      description: "For a bank statement (alone, or uploaded with a processing statement): what the account shows about card processing and related costs.",
      required: ["bank_name", "months_covered", "card_deposits", "processing_fees", "software_fees", "misc_fees", "mca_payments", "mca_funding", "chargebacks"],
      properties: {
        bank_name: str,
        months_covered: { type: "integer", description: "Monthly statement periods in the upload (usually 1)." },
        card_deposits: bankGroup("Settlements of card sales from processors, payment facilitators, or card networks (Square, Toast, Clover/First Data 'Bankcard' deposits, Stripe, PayPal sales payouts, Heartland, Worldpay, TSYS, Elavon, Amex settlements)."),
        processing_fees: bankGroup("Fees the card processor debits (discount, monthly, statement, PCI, processor chargeback fees)."),
        software_fees: bankGroup("POS / payment software subscriptions, gateway fees, and POS terminal leases or rentals. Not general business software."),
        misc_fees: bankGroup("Fees the bank charges: service charge, NSF, overdraft, returned item, wire, ATM fees."),
        mca_payments: bankGroup("Merchant cash advance and business loan repayments, including processor capital programs (Square Capital, Toast Capital, PayPal Working Capital, Shopify Capital)."),
        mca_funding: bankGroup("Cash advance or business loan proceeds received."),
        chargebacks: bankGroup("Card chargebacks or disputes debited by the processor."),
      },
    }),
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

const SYSTEM_PROMPT = `You read merchant credit card processing statements, and merchants' bank statements, for a payments sales team that prepares cost comparisons. Extract the facts exactly as the statement shows them; the numbers feed a savings proposal, so accuracy matters more than completeness. Use null for anything the statement does not show rather than guessing.

How to read the key totals:
- volume: the total card sales submitted for the statement period (labels such as "Amounts Submitted", "Total Gross Sales", "Total Sales", "Plan Summary" totals, or the card-type summary total). Use gross sales before refunds, and report refunds separately.
- transactions: the number of sales transactions/items for the period. If only an average ticket is printed, compute volume ÷ average ticket, round it, and set transactions_derived to true.
- total_fees: everything the merchant paid to accept cards for this period — discount/processing fees (including fees deducted daily), interchange and pass-through, card brand/network fees, and monthly, service, PCI, statement, gateway, and equipment fees. Prefer the statement's own total ("Fees Charged", "Total Fees", "Total Monthly Fees", "Amount Total", "Total Charges and Fees"). When a statement splits "Discount Due" and "Fees Due", add them together. If only the summary page is present and it shows the month-end "Amount Deducted" but no fee totals, use that amount and say so in notes. Do not count chargeback or refund amounts, loan/capital repayments, or taxes as fees. If the statement shows rebates or credits against fees, keep total_fees as the gross amount charged and mention the net figure in notes.
- card_mix: one row per card brand and credit/debit type from the card-type or plan-code summary (VS/VD/MC/MD/DS/AM style codes count). PIN debit networks (Interlink, STAR, Pulse, Accel, Maestro, NYCE) go under pin_debit. Use type "unknown" when the statement does not separate credit from debit for a brand.
- interchange_lines: only when the statement itemizes interchange programs (for example "VI-CPS/RETAIL ALL OTHER (DB)", "MC-WORLD ELITE MERIT III", "Retail Product 2 Signature Preferred"). Copy each program name exactly. Convert decimal rates to percent (0.0165 → 1.65). Leave this empty for flat-rate or tiered statements.

Merchant identity: merchant_name is the business the customer knows (the DBA or location name). Statements often print an owner or contact person above or below the business name — never use a person's name as merchant_name. The address is the merchant's business location; prefer a "Location" address over a mailing address or PO box when both appear, and never use the processor's or ISO's address.

Several photos are pages of one statement: combine them. Agents often photograph pages with a phone, so photos can be skewed, shaded, out of order, or include the same page twice — combine them without double counting, read what is legible, and lower confidence if a key total is hard to read or its page is missing. Report only what the pages show; if the summary page was not photographed, leave those totals null rather than rebuilding them from partial detail. Several PDF files may instead be separate statements: consecutive monthly bank statements (add them up, and never drop a payment because the same amount appears in another month), or a processing statement together with a bank statement.

Bank statements: the upload may instead be the merchant's bank account statement. Then set document_type to "bank_statement" and fill bank:
- Read every transaction on every page and sort it into exactly one category. card_deposits: settlements of card sales from a processor, payment facilitator, or card network (including payment payouts from industry POS systems, such as Tekmetric Payments). Cash or check deposits, transfers between the owner's accounts, person-to-person payments (Zelle, Venmo, Cash App), loan proceeds, refunds, fee adjustments, and chargeback reversals are not card sales. processing_fees: the processor's fee debits. software_fees: POS software (including industry POS such as Tekmetric or Mindbody), payment gateways, and POS terminal leases or rentals — not payroll (Gusto, ADP), bookkeeping (QuickBooks), website, shipping, or other general business software. misc_fees: the bank's own fees (service charges, NSF, overdraft, returned-item and wire fees), less any fee the bank reversed. A returned deposited check is not a fee; only its returned-item fee is. mca_payments: merchant cash advance or business-loan repayments, including processor capital programs and SBA loans, and repeated daily or weekly debits to a funder you don't recognize by name (for example "… Funding" or "… Fnd Daily Pmt"); consumer loans, mortgages, and credit card bill payments are not. mca_funding: advance or loan proceeds. chargebacks: card chargeback debits. Everything else is left out.
- A payment that was rejected or returned and credited back is not a cost: leave out both the debit and the credit.
- A card network name on a DEBIT is usually the merchant paying its own credit card bill (for example "AMERICAN EXPRESS ACH PMT" or "DISCOVER E-PAYMENT"), not a fee. On a CREDIT it is a settlement.
- Totals cover the whole upload; set months_covered to the number of months the statement periods cover (one monthly statement listing a savings and a checking account is still one month; a bank statement file that prints no period counts as one month; other files such as check images add none).
- Also set volume = card_deposits.total ÷ months_covered, total_fees = (processing_fees.total + software_fees.total) ÷ months_covered, transactions = null (a bank statement doesn't show card transaction counts), processor = the bank name, and merchant_name and address from the account holder (the business, not the bank). Note in notes when no separate processing-fee debits appear: the processor then takes fees out of each deposit, so deposits are net of fees.
For a processing statement set document_type to "processing_statement" and bank to null. When the upload has both a processing statement and a bank statement, set document_type to "processing_statement", take volume, total_fees, transactions, card mix and interchange from the processing statement, and fill bank from the bank statement (its months_covered counts only the bank statement periods).

If the files are neither a merchant card-processing statement nor a bank statement (for example a driver's license, a check, a receipt, or a credit card bill), set is_statement to false, document_type to "other", leave every other field null or empty, and name the kind of document in notes. Never transcribe personal identifiers such as license, account, routing, card, or Social Security numbers.`;

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
    text: files.length > 1 && files.every((f) => f.media_type !== "application/pdf")
      ? `These ${files.length} files are pages of one merchant statement (a card-processing statement or a bank statement). Extract the statement details.`
      : files.length > 1
      ? `These ${files.length} files are one merchant's statements: one statement, several monthly bank statements, or a processing statement with a bank statement. Extract the statement details.`
      : "Extract the details from this merchant statement (a card-processing statement or a bank statement).",
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
