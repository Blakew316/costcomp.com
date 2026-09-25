# Wholesale Payments — Cost Comparison

The cost comparison tool deployed at wpicostcomp.com. Site files live in `public/`; the AI statement reader is a Netlify Function in `netlify/functions/`.

## Scan Statement

Agents click **Scan Statement** in the header and choose how the statement arrived. The statement can be the merchant's processing statement or bank statement (see [Bank statements](#bank-statements)):

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

## Bank statements

The same Scan Statement buttons also read a merchant's **bank statement**, as a downloaded PDF, a scan, or photos. There's no separate option: the reader recognizes a bank statement on its own and marks the review **Bank statement**.

From a bank statement it fills in:

- **Monthly Card Volume**: deposits from card processors, such as Square, Toast, Clover and Fiserv "Bankcard" deposits, Stripe, PayPal, Heartland, Worldpay, TSYS, Elavon, and Amex settlements. Cash and check deposits, transfers, Zelle, loan proceeds, refunds, and chargeback reversals don't count as card sales.
- **Total Monthly Fees**: processing fees plus POS software and equipment. The review lists each cost category per month, with who it was paid to. Checked rows add up to Total Monthly Fees:

  | Row | Counts | Checked by default |
  | --- | --- | --- |
  | Processing fees | The processor's fee debits (discount, monthly, PCI, statement fees) | Yes |
  | POS software & equipment | POS subscriptions, app market, gateways, and terminal leases or rentals. Payroll, bookkeeping, website, and other general software doesn't count. | Yes |
  | Bank fees | Service charges, NSF and overdraft fees, returned-item and wire fees, less refunds of those fees | No |
  | Cash advance / loan payments | Merchant cash advance and business-loan payments: named funders, processor capital programs (Square Capital, Toast Capital, PayPal loans), SBA loans, and payment debits to an unnamed "… Funding" payee | No |

- **# of Transactions** stays blank, because bank statements don't show card transaction counts. The agent enters it from the processing statement or the POS. The markup estimate, in the review and on the Overview, waits for that number.

The review also points out:

- **Deposits net of fees.** Square, Stripe, and many Clover accounts take their fees out of each payout, so no fee debits appear. The review says so, and the processing statement is needed for exact fees.
- **Possible cash advances.** Repeating identical debits to an unknown payee are flagged.
- **Returned payments.** A payment that was returned unpaid isn't counted as a cost. If it was a lender's payment, the review says so.
- **Settlements under the merchant's own name.** Some processors send deposits under the business's own name; these are counted as card deposits and flagged for the agent to confirm.
- **Totals that don't add up.** For a single statement, the amounts read are checked against the statement's own deposit total and its beginning and ending balances. If they don't match (for example, a scan misread a digit), the review asks the agent to compare them with the statement.

When several monthly statements are uploaded together, the figures are averaged per month. The months come from the statement periods; the same period in two files (checking and savings) counts once, and a bank statement file that prints no period counts as one month (or one per statement in it). Other files uploaded along with it, such as check images, add no months. The AI reader follows the same rules.

A processing statement uploaded together with the bank statement, as a separate PDF, is read as a processing statement. Volume, fees, and transactions come from it, and the bank statement's software, bank-fee, and cash-advance rows are listed underneath, unchecked. Checking a row adds it to Total Monthly Fees. The bank statement's own flags (possible cash advances, returned lender payments, totals that don't add up) still show, marked "Bank statement:".

**Bank statement accuracy.** Measured on 37 real bank statements (29 text PDFs, 8 scanned), against an answer key built by two independent readers and reconciled where they disagreed:

| Field | Text PDFs (29) | Scanned, read on-device (8) |
| --- | --- | --- |
| Recognized as a bank statement | 29 of 29 | 8 of 8 |
| Card-processor deposits | 29 of 29 | 8 of 8 |
| Processing fees | 28 of 29 | 7 of 8 |
| POS software & equipment | 28 of 29 | 8 of 8 |
| Bank fees | 29 of 29 | 6 of 8 |
| Cash advance / loan payments | 28 of 29 | 7 of 8 |

The text-PDF misses are judgment calls: an equipment lease from an unnamed lessor, and two debits returned unpaid that the key counted anyway. On every text PDF whose beginning and ending balances the reader recognizes, the transactions read reconcile to the cent. The scanned misses:

- A small fee printed too faintly to read.
- Bank fees counted after the bank's refunds, which matches that statement's own service-charge total. The key counted them before the refunds.
- Recurring debits to a payroll-financing service that the key itself marked as uncertain.
- A fee that OCR read with an extra digit. The totals check flags that statement for the agent.

Six synthetic statements in other bank layouts (Chase, Bank of America, Wells Fargo, Truist, credit union, and community bank styles), with every transaction labeled, are all read correctly, both as text and through OCR.

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
npm test        # parser, bank statements, OCR line building, Appendix G matching, markup math, and the function (against a mock API)
```

Serve `public/` with any static server for the on-device reader, or use `netlify dev` to run the function locally.
