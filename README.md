# Wholesale Payments — Cost Comparison

The cost comparison tool deployed at wpicostcomp.com. Site files live in `public/`; the AI statement reader is a Netlify Function in `netlify/functions/`.

## Scan Statement

Agents click **Scan Statement** in the header and choose how the statement arrived:

- **PDF Statement**: the PDF the merchant downloaded or emailed (text or scanned).
- **Statement Photos**: phone photos of the paper statement, one per page. Select all the pages at once. A page tray shows thumbnails so the agent can put the summary page first, remove a bad shot, or add a missed page before reading.
- **Take Photos** (phones and tablets): opens the back camera, one page at a time, into the same tray.

PDFs or photos can also be dragged onto the page. After reading, a review window shows what was found (with the photos alongside, tap one to compare), and **Apply & Generate Analysis** fills in the merchant name, address, monthly volume, transaction count, and total fees. The Overview, Proposal, and Equipment tabs then update automatically.

Three readers are built in:

| Reader | Handles | Needs |
| --- | --- | --- |
| On-device text reader (`public/scan-core.js`) | Downloaded or emailed PDF statements that contain text. Instant and exact. Tested on 87 real statements from Payroc, Fiserv/First Data (Clover, CardPointe, eCrypt, AppStar), North, TSYS/Paysafe, Clover billing, Toast, SpotOn, Shift4, and U.S. Bank. | Nothing |
| On-device photo reader (Tesseract.js OCR in `public/scan.js`) | Photos and scanned (image-only) PDFs, read in the browser. Straightens tilted photos and turns sideways or upside-down pages. Also reads Worldpay, Worldpay Integrated Payments, and Square sales summaries. The first use downloads about 3 MB from jsDelivr; after that it's cached. | Nothing |
| AI reader (`netlify/functions/scan-statement.mts`) | Photos, scans, and any layout the on-device readers can't fully read. Uses Claude via the Anthropic API. Recognizes uploads that aren't statements (an ID, a check) and never transcribes personal identifiers. | `ANTHROPIC_API_KEY` set in Netlify |

How a scan is routed:

1. A text PDF that the on-device reader reads completely is shown right away. When the AI reader is configured, the review also offers **Double-check with AI**.
2. Photos, scans, and incomplete reads go to the AI reader when the site has one.
3. Otherwise, or if the AI reader fails, the on-device photo reader handles them. The review then says the numbers were read from photos and asks the agent to compare them with the photos before applying.

Photos that aren't a statement are rejected with a clear message. So are statements too blurry or low-resolution to read, with a note to retake the photos or rescan at 200 dpi or higher.

**Photo accuracy.** Measured on the sample photo sets and scanned PDFs (36 uploads; 33 statements). An answer key was built by two independent readers per upload, reconciled, and spot-checked against the images. Counts are fields the statement actually shows:

| Field | On-device photo reader | AI reader (simulated) |
| --- | --- | --- |
| Merchant name | 27 of 29 | 29 of 29 |
| Address | 30 of 31 | 31 of 31 |
| Monthly volume | 30 of 31 | 29 of 31 (30 within 0.1%) |
| Transactions | 28 of 29 | 28 of 29 |
| Total fees | 26 of 31 (29 within 0.1%) | 27 of 31 (29 within 0.1%) |

The on-device misses are a 75-dpi fax the reader can't make out (the agent is told to rescan) and "ñ" read as "fi". The rest are 2-cent Toast fee adjustments and a $25 add-on fee that the key counts differently. Uploads that are not statements (an ID and a check) are rejected. Partial uploads, like a lone fees page, leave fields for the agent to fill in.

For the most reliable photo reads, turn on the AI reader (see below).

## Markup vs. Appendix G

After a scan, the Overview tab shows **Current Processor Markup vs. Appendix G Wholesale Cost**:

- **True wholesale cost** = interchange at the Appendix G rates (`public/data/appendix-g.json`, parsed from the Appendix G Interchange Rate/Fee Schedule) + estimated card-brand assessments + estimated American Express cost.
- **Processor markup** = the statement's total fees − true wholesale cost, shown per month, per year, as a percentage of volume, and as a share of the fees.
- **Itemized** statements (ones that list interchange programs, like Payroc and Fiserv IC-plus statements) are priced line by line. Each program is matched to Appendix G by name or by charged rate. When the statement bills more than Appendix G for the same program, the card calls out the interchange markup.
- **Estimated** statements (flat-rate or tiered, showing only a card-brand breakdown) price each card type with a default Appendix G program. Defaults: Visa credit J58, Visa debit N01, Mastercard credit 097, Mastercard debit N03, Discover credit 010, Discover debit 737. Agents can pick a different program per card type. These defaults were checked against the itemized sample statements and land at a median of 0.96× the line-by-line cost.
- Card-brand assessments (default 0.14% + $0.02 per transaction) and the American Express rate (not in Appendix G; default 1.60% + $0.10) are editable on the card.

The markup analysis is on-screen only; the emailed/downloaded proposal PDF is unchanged.

## Deploying on Netlify

The **enchanting-sprinkles-fa7ad4** project (wpicostcomp.com) deploys from this repository's `main` branch. Every push or merge to `main` publishes the site. `netlify.toml` sets the publish directory (`public`) and the functions directory. Changes on other branches don't go live until they're merged into `main`.

To turn on the AI reader:

1. Under **Project configuration → Environment variables**, add `ANTHROPIC_API_KEY` (an Anthropic API key, scoped to Functions). Optional: `ANTHROPIC_MODEL` (default `claude-opus-5`) and `SCAN_EFFORT` (`low` by default; `medium` reads more carefully but takes longer).
2. Redeploy (**Deploys → Trigger deploy**). Visiting `/api/scan-statement` should return `{"configured":true}`.

Netlify functions stop after 60 seconds, so the AI reader asks for compact output and gives up at 50 seconds. On a timeout, the page falls back to the on-device reader, or asks for just the summary pages.

If you ever deploy by drag-and-drop instead, drag the `public` folder, not the repository or a zip. Both on-device readers and the markup analysis work that way, but the AI reader needs the Git-linked deploy.

**Privacy:** the on-device readers, including the photo reader, never upload the statement; photos are read in the browser. The AI reader sends the statement through the Netlify Function to the Anthropic API for that one request. The site stores nothing.

## Development

```bash
npm install
npm test        # parser, OCR line building, Appendix G matching, markup math, and the function (against a mock API)
```

Serve `public/` with any static server for the on-device reader, or use `netlify dev` to run the function locally.
