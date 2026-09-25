# Wholesale Payments — Cost Comparison

The cost comparison tool deployed at wpicostcomp.com. Site files live in `public/`; the AI statement reader is a Netlify Function in `netlify/functions/`.

## Scan Statement

Agents click **Scan Statement** in the header (or drag a PDF onto the page), pick the merchant's statement, review what was read, and click **Apply & Generate Analysis**. The merchant name, address, monthly volume, transaction count, and total fees are filled in, and the Overview, Proposal, and Equipment tabs update automatically. On phones the button offers the camera, so a paper statement can be photographed page by page.

Two readers are built in:

| Reader | Handles | Needs |
| --- | --- | --- |
| On-device (`public/scan-core.js`) | Downloaded or emailed PDF statements that contain text. Instant, free, and the statement never leaves the device. Tested on 87 real statements from Payroc, Fiserv/First Data (Clover, CardPointe, eCrypt, AppStar), North, TSYS/Paysafe, Clover billing, Toast, SpotOn, Shift4, and U.S. Bank. | Nothing |
| AI (`netlify/functions/scan-statement.mts`) | Photos, scanned (image-only) PDFs, and any layout the on-device reader can't fully read. Uses Claude via the Anthropic API. | `ANTHROPIC_API_KEY` set in Netlify |

The page reads PDFs on-device first and only calls the AI reader when a photo or scan is uploaded or the on-device read is incomplete. When the AI reader is configured, the review window also offers **Double-check with AI**. If the AI reader is unavailable, the page keeps working with the on-device reader.

## Markup vs. Appendix G

After a scan, the Overview tab shows **Current Processor Markup vs. Appendix G Wholesale Cost**:

- **True wholesale cost** = interchange at the Appendix G rates (`public/data/appendix-g.json`, parsed from the Appendix G Interchange Rate/Fee Schedule) + estimated card-brand assessments + estimated American Express cost.
- **Processor markup** = the statement's total fees − true wholesale cost, shown per month, per year, as a percentage of volume, and as a share of the fees.
- **Itemized** statements (ones that list interchange programs, like Payroc and Fiserv IC-plus statements) are priced line by line. Each program is matched to Appendix G by name or by charged rate. When the statement bills more than Appendix G for the same program, the card calls out the interchange markup.
- **Estimated** statements (flat-rate or tiered, showing only a card-brand breakdown) price each card type with a default Appendix G program. Defaults: Visa credit J58, Visa debit N01, Mastercard credit 097, Mastercard debit N03, Discover credit 010, Discover debit 737. Agents can pick a different program per card type. These defaults were checked against the itemized sample statements and land at a median of 0.96× the line-by-line cost.
- Card-brand assessments (default 0.14% + $0.02 per transaction) and the American Express rate (not in Appendix G; default 1.60% + $0.10) are editable on the card.

The markup analysis is on-screen only; the emailed/downloaded proposal PDF is unchanged.

## Deploying on Netlify

The site was previously deployed by drag-and-drop, which serves static files only. To turn on the AI reader:

1. In Netlify, open the **enchanting-sprinkles-fa7ad4** project → **Project configuration → Build & deploy → Continuous deployment → Link repository**, and choose this GitHub repository. `netlify.toml` already sets the publish directory (`public`) and functions directory.
2. Under **Project configuration → Environment variables**, add `ANTHROPIC_API_KEY` (an Anthropic API key, scoped to Functions). Optional: `ANTHROPIC_MODEL` (default `claude-opus-5`) and `SCAN_EFFORT` (`low` by default; `medium` reads more carefully but takes longer).
3. Deploy. Visiting `/api/scan-statement` should return `{"configured":true}`.

Netlify functions stop after 60 seconds, so the AI reader asks for compact output and gives up at 50 seconds. On a timeout, the page falls back to the on-device reader, or asks for just the summary pages.

Drag-and-drop deploys still work: drag the `public` folder. The on-device reader and markup analysis work there; photos and scanned PDFs need the AI reader.

**Privacy:** the on-device reader never uploads the statement. The AI reader sends the statement through the Netlify Function to the Anthropic API for that one request; nothing is stored by the site.

## Development

```bash
npm install
npm test        # parser, Appendix G matching, markup math, and the function (against a mock API)
```

Serve `public/` with any static server for the on-device reader, or use `netlify dev` to run the function locally.
