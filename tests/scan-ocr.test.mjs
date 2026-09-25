// Photo / scanned-statement reading: OCR clean-up, line building from tilted photos, and the layouts
// that appear mostly as photos or scans. All fixtures are synthetic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Core = require('../public/scan-core.js');

const page = rows => ({ width: 612, lines: rows.map(r => ({ text: r.map(s => s[1]).join(' | '), segs: r.map(([x, t]) => ({ t, x })) })) });

// Tesseract-shaped page: rows of [x, 'text'] words on a baseline that may tilt; slope(y) gives the tilt per row
function ocrPage(rows, slope) {
  const W = 1800, H = 2400, lines = [];
  rows.forEach((row, i) => {
    const y = 200 + i * 60, k = typeof slope === 'function' ? slope(y) : (slope || 0);
    row.forEach(([x, t]) => {
      const w = t.length * 22, dy = k * (x + w / 2 - W / 2);
      lines.push({
        baseline: { x0: x, y0: y + dy, x1: x + w, y1: y + dy + k * w },
        words: t.split(' ').map((word, j, all) => {
          const wx = x + all.slice(0, j).join(' ').length * 22 + (j ? 22 : 0), ww = word.length * 22, wy = y + k * (wx + ww / 2 - W / 2);
          return { t: word, c: 92, b: { x0: wx, y0: wy - 30, x1: wx + ww, y1: wy } };
        }),
      });
    });
  });
  return { width: W, height: H, conf: 90, lines };
}

test('normalizeOcrWord repairs digit confusions inside numbers only', () => {
  const n = Core.normalizeOcrWord;
  assert.equal(n('S1,234.56'), '$1,234.56');
  assert.equal(n('§12.00'), '$12.00');
  assert.equal(n('1O4.5O'), '104.50');
  assert.equal(n('1.234.56'), '1,234.56');
  assert.equal(n('1,234,56'), '1,234.56');
  assert.equal(n('"12,345.67'), '12,345.67');
  assert.equal(n('Sales'), 'Sales');
  assert.equal(n('SOLD'), 'SOLD');
  assert.equal(n('I'), 'I');
});

test('ocrQuality separates a readable page from a sideways one', () => {
  const good = Core.ocrQuality({ lines: [{ words: [{ t: 'Total', c: 95 }, { t: 'Sales', c: 93 }, { t: '$1,200.00', c: 90 }] }] });
  const bad = Core.ocrQuality({ lines: [{ words: [{ t: '~', c: 30 }, { t: 'ii', c: 40 }, { t: 'Ail', c: 55 }, { t: 'Tota', c: 80 }] }] });
  assert.deepEqual([good.good, good.all], [3, 3]);
  assert.equal(bad.good, 1);
  assert.ok(bad.ratio < 0.5);
});

test('buildPageLinesFromOcr straightens a tilted photo so labels and values share a line', () => {
  const rows = [[[200, 'Amounts Submitted'], [1400, '$54,210.00']], [[200, 'Fees Charged'], [1400, '$1,440.10']], [[200, 'Amount Funded'], [1400, '$52,769.90']]];
  const p = Core.buildPageLinesFromOcr(ocrPage(rows, 0.03));
  assert.deepEqual(p.lines.map(l => l.text), ['Amounts Submitted | $54,210.00', 'Fees Charged | $1,440.10', 'Amount Funded | $52,769.90']);
  assert.ok(Math.abs(p.ocr.skew - 0.03) < 0.002);
});

test('buildPageLinesFromOcr follows perspective: rows near the top tilt more than rows near the bottom', () => {
  const rows = [];
  for (let i = 0; i < 30; i++) rows.push([[150, 'Row ' + i + ' Label Text'], [1450, '$' + (100 + i) + '.00']]);
  const p = Core.buildPageLinesFromOcr(ocrPage(rows, y => 0.04 - 0.035 * y / 2400));   // one global slope splits these rows
  assert.equal(p.lines.length, 30);
  p.lines.forEach((l, i) => assert.equal(l.text, 'Row ' + i + ' Label Text | $' + (100 + i) + '.00'));
});

test('parses a photographed statement end to end from OCR words', () => {
  const rows = [
    [[120, 'YOUR CARD PROCESSING STATEMENT']],
    [[120, 'SAMPLE BIKE SHOP LLC']], [[120, '42 ELM ST']], [[120, 'SPRINGFIELD, TX 75001']],
    [[200, 'Page'], [300, 'Amounts Submitted'], [1400, '$25,000.00']],
    [[200, 'Page'], [300, 'Fees Charged'], [1400, '$750.00']],
    [[120, 'SUMMARY BY CARD TYPE'], [600, 'Total Gross Sales You Submitted']],
    [[120, 'Card Type'], [600, 'Items'], [900, 'Amount']],
    [[120, 'VISA'], [600, '300'], [900, '$15,000.00']], [[120, 'MASTERCARD'], [600, '200'], [900, '$10,000.00']],
    [[120, 'Total'], [600, '500'], [900, '$25,000.00']],
  ];
  const r = Core.parseStatement([Core.buildPageLinesFromOcr(ocrPage(rows, 0.02))], {});
  assert.equal(r.merchant_name, 'Sample Bike Shop LLC');
  assert.equal(r.address, '42 Elm St, Springfield, TX 75001');
  assert.equal(r.volume, 25000);
  assert.equal(r.total_fees, 750);
  assert.equal(r.transactions, 500);
});

test('TSYS plan summary whose "**" total label was lost still yields the total row', () => {
  const r = Core.parseStatement([page([
    [[40, 'SAMPLE WINE BAR']], [[40, '10 OAK AVE']], [[40, 'SPRINGFIELD TN 37000']],
    [[40, 'Plan Summary']],
    [[40, 'Plan'], [90, 'Number of'], [150, 'Amount of'], [400, 'Discount']],
    [[40, 'VS'], [90, '400'], [150, '16,000.00'], [250, '16,000.00'], [320, '40.00'], [400, '416.00']],
    [[40, 'MC'], [90, '100'], [150, '4,000.00'], [250, '4,000.00'], [320, '40.00'], [400, '104.00']],
    [[40, 'DS'], [90, '00'], [320, '2.6000']],
    [[90, '500'], [150, '20,000.00'], [250, '20,000.00'], [320, '40.00'], [400, '520.00']],
    [[40, 'Deposits']],
    [[40, '01'], [90, '90001234567'], [150, '100'], [200, '4,000.00'], [300, '104.00']],
    [[40, 'Discount Due'], [400, '520.00']], [[40, 'Fees Due'], [400, '80.00']],
  ])], {});
  assert.equal(r.family, 'tsys');
  assert.equal(r.volume, 20000);
  assert.equal(r.transactions, 500);
  assert.equal(r.total_fees, 600);
});

test('TSYS summary page alone falls back to the month-end amount deducted', () => {
  const r = Core.parseStatement([page([
    [[40, 'Merchant Statement']], [[300, 'Deducted:']], [[300, '$ 912.40']],
    [[40, 'SAMPLE SMOKE SHOP']], [[40, '77 PINE RD']], [[40, 'SPRINGFIELD TX 78000']],
    [[40, 'Plan Summary']],
    [[40, 'VS'], [90, '600'], [150, '18,000.00'], [250, '18,000.00'], [320, '30.00'], [400, '612.00']],
    [[40, 'MC'], [90, '200'], [150, '6,000.00'], [250, '6,000.00'], [320, '30.00'], [400, '204.00']],
    [[40, '**'], [90, '800'], [150, '24,000.00'], [250, '24,000.00'], [320, '30.00'], [400, '816.00']],
  ])], {});
  assert.equal(r.volume, 24000);
  assert.equal(r.total_fees, 912.4);
});

test('Worldpay merchant billing statement: card fees totals row and total fees for billing period', () => {
  const r = Core.parseStatement([page([
    [[40, 'MERCHANT BILLING STATEMENT']], [[40, 'WORLDPAY, LLC']],
    [[40, 'SAMPLE OWNER NAME'], [400, 'Statement Date'], [480, 'June 6, 2026']], [[40, '5 MAPLE PIKE'], [400, 'Statement Period May, 2026']], [[40, 'SPRINGFIELD, TN 37000-1234']],
    [[40, 'Billing Payment Summary']], [[40, 'Total Fees For Billing Period'], [480, '$412.50']],
  ]), page([
    [[40, 'Card Fees']],
    [[40, 'Card Type'], [200, 'Count'], [300, 'Amount']],
    [[40, 'Visa'], [200, '10'], [300, '8,000.00']], [[40, 'Mastercard'], [200, '6'], [300, '4,500.00']],
    [[40, 'Totals'], [200, '16'], [300, '12,500.00']],
  ])], {});
  assert.equal(r.family, 'worldpay');
  assert.equal(r.processor, 'Worldpay');
  assert.equal(r.volume, 12500);
  assert.equal(r.transactions, 16);
  assert.equal(r.total_fees, 412.5);
});

test('Worldpay Integrated statement: "12.345" count read as thousands and fees rebuilt from sections when the total is garbled', () => {
  const r = Core.parseStatement([page([
    [[40, 'MERCHANT STATEMENT'], [400, 'worldpay integrated']], [[40, 'WORLDPAY INTEGRATED PAYMENTS']],
    [[40, 'ATTENTION: SAMPLE PERSON']], [[40, 'SAMPLE GIFTS LLC']], [[40, '9 SUNSET BLVD']], [[40, 'DBA NAME: SAMPLE GIFTS']], [[40, 'SPRINGFIELD, CA 90000']],
    [[40, 'DEPOSIT SUMMARY']], [[40, '01-Aug'], [120, '179.02'], [200, '0.00'], [300, '179.02']],
  ]), page([
    [[40, 'Card Type'], [120, 'Settled Sales'], [220, 'Amount of Sales']],
    [[40, 'VISA'], [120, '7,000'], [220, '280,000.00'], [320, '10'], [380, '200.00'], [440, '279,800.00'], [500, '40.00'], [560, '350.00']],
    [[40, 'MASTERCARD'], [120, '5,345'], [220, '213,800.00'], [320, '5'], [380, '100.00'], [440, '213,700.00'], [500, '40.00'], [560, '267.25']],
    [[40, 'Total'], [120, '12.345'], [220, '493,800.00'], [320, '15'], [380, '300.00'], [440, '493,500.00'], [500, '40.00'], [560, '617.25']],
    [[40, 'Total Interchange and Worldpay Fees'], [500, '8,000.00']],
    [[40, 'Total Other Fees'], [500, '12,000.00']],
    [[40, 'TOTAL FEES']], [[40, 'Discount Collected'], [500, '0.00']], [[40, 'Total Ices'], [500, '20,617.25']],
  ])], {});
  assert.equal(r.family, 'worldpay_ip');
  assert.equal(r.merchant_name, 'Sample Gifts');
  assert.equal(r.volume, 493800);
  assert.equal(r.transactions, 12345);
  assert.equal(r.total_fees, 20617.25);
});

test('Worldpay Integrated: a total fees value that disagrees with its sections loses to the sections', () => {
  const r = Core.parseStatement([page([
    [[40, 'MERCHANT STATEMENT'], [400, 'worldpay integrated']], [[40, 'SAMPLE STORE']], [[40, '1 MAIN ST']], [[40, 'TOLEDO, OH 43604']],
    [[40, 'Card Type'], [120, 'Settled Sales']],
    [[40, 'Total'], [120, '1,000'], [220, '40,000.00'], [320, '2'], [380, '50.00'], [440, '39,950.00'], [500, '40.00'], [560, '100.00']],
    [[40, 'Total Interchange and Worldpay Fees'], [500, '700.00']], [[40, 'Total Other Fees'], [500, '400.00']],
    [[40, 'Discount Collected'], [500, '0.00']], [[40, 'Total Fees'], [500, '1,700.00']],
  ])], {});
  assert.equal(r.total_fees, 1200);
});

test('Shift4 is recognised by its fee summary when the logo is unreadable, and a misread add-on fee is corrected', () => {
  const r = Core.parseStatement([page([
    [[40, 'SHIFT"'], [300, 'MERCHANT STATEMENT FOR 05/2026']], [[300, 'DBA NAME: SAMPLE MARKET']],
    [[40, 'SAMPLE MARKET']], [[40, '3 CEDAR RD']], [[40, 'SPRINGFIELD, AZ 85000-1234']],
    [[40, 'TOTAL PROCESSING SERVICE FEES APPLIED FOR THE REPORTING PERIOD'], [500, '$1,100.00']],
    [[40, 'ADDITIONAL SERVICES FEE TOTAL?'], [500, '525.00']],   // "$25.00" misread
    [[40, '0099000000 VISA'], [200, '$30,000.00'], [280, '300'], [340, '$0.00'], [420, '$30,000.00'], [500, '300']],
    [[40, 'ACTIVITY TOTAL00'], [200, '$40,000.00'], [280, '400'], [340, '($100.00)'], [420, '$39,900.00'], [500, '401']],
  ]), page([
    [[40, 'ADDITIONAL SERVICES DETAIL SAMPLE MARKET'], [400, 'USD']],
    [[40, '0099000001'], [120, 'GIFT CARD SERVICE'], [260, '1'], [300, '$25.00'], [360, '$25.00'], [420, '$0.00'], [480, '$25.00']],
    [[40, 'ADDITIONAL SER'], [120, 'TOTAL'], [300, '$25.00'], [360, '$0.00'], [480, '$25.00']],
  ])], {});
  assert.equal(r.family, 'shift4');
  assert.equal(r.volume, 40000);
  assert.equal(r.transactions, 400);
  assert.equal(r.total_fees, 1125);
});

test('Square sales summary: card payments and fees', () => {
  const r = Core.parseStatement([page([
    [[40, 'Mar 1, 2025-Mar 31 2025']], [[40, 'Sales Summary']],
    [[40, 'Gross Sales'], [400, '$50,000.00']], [[40, 'Net Sales'], [400, '$49,800.00']], [[40, 'Total Sales'], [400, '$53,000.00']],
    [[40, 'Payments']], [[40, 'Total Collected'], [400, '$52,990.00']], [[40, 'Cash'], [400, '$990.00']], [[40, 'Card'], [400, '$52,000.00']],
  ]), page([[[40, 'Fees'], [400, '($1,820.00)']], [[40, 'Net Total'], [400, '$51,170.00']]])], {});
  assert.equal(r.family, 'square');
  assert.equal(r.processor, 'Square');
  assert.equal(r.volume, 52000);
  assert.equal(r.total_fees, 1820);
});

test('a suite number wrapped onto the city line stays with the street', () => {
  const r = Core.parseStatement([page([
    [[40, 'Statement Date:'], [140, '3/31/25'], [300, 'Merchant ID:'], [400, '4440000000001']],
    [[40, 'Statement'], [140, '3/01/25 -'], [300, 'Merchant Name'], [400, 'Sample Curry House']],
    [[40, 'Merchant'], [140, '400 Main St Suite']],
    [[40, 'Address:'], [140, '#200 Springfield, TX 75001']],
    [[40, 'Card Processing'], [300, 'Visa / MasterCard / Discover / Amex']],
    [[40, 'Total'], [100, '1000'], [160, '$40,000.00'], [240, '0'], [280, '$0.00'], [340, '$1,100.00'], [400, '$0.00'], [460, '$1,100.00']],
  ])], {});
  assert.equal(r.address, '400 Main St Suite #200, Springfield, TX 75001');
});

test('labels with the space dropped by OCR are not taken as the merchant name', () => {
  const r = Core.parseStatement([page([
    [[40, 'YOUR CARD PROCESSING STATEMENT']],
    [[300, 'CustomerService'], [420, '1-800-555-0100']], [[300, 'MerchantNumber'], [420, '5300000000000']],
    [[40, 'Location:']], [[40, 'SAMPLE TRACTOR SALES']], [[40, '12 FARM RD']], [[40, 'SPRINGFIELD TX 75001-1234']],
    [[40, 'Page'], [100, 'Amounts Submitted'], [400, '$10,000.00']], [[40, 'Page'], [100, 'Fees Charged'], [400, '$300.00']],
  ])], {});
  assert.equal(r.merchant_name, 'Sample Tractor Sales');
  assert.equal(r.address, '12 Farm Rd, Springfield, TX 75001');
});

test('Clover billing: transaction count two lines under the label', () => {
  const r = Core.parseStatement([page([
    [[40, 'Bill to'], [300, 'Details']], [[40, 'SAMPLE DISCOUNT LLC']], [[40, '8 RIVER ST']], [[40, 'SPRINGFIELD, WI, 53000']],
    [[40, 'Billing Account']],
    [[40, 'Total Sales'], [200, 'Transaction']], [[200, 'Count']], [[40, '$20,000.00'], [200, '150']],
    [[40, 'Subtotal in USD'], [300, '$600.00']], [[40, 'Amount Total:'], [300, '$600.00']],
  ])], {});
  assert.equal(r.family, 'clover_billing');
  assert.equal(r.volume, 20000);
  assert.equal(r.transactions, 150);
  assert.equal(r.total_fees, 600);
});

test('a logo word floating above the address block is not taken as the merchant name', () => {
  const rows = [
    [[120, 'Merchant Statement']], [[120, 'mave']], [], [], [],
    [[120, 'FRUGAL SAM']], [[120, '10 OAK RD']], [[120, 'SPRINGFIELD TN 37000']],
    [[120, 'Total Amount Submitted'], [1300, '$12,000.00']], [[120, 'Total Fees Charged'], [1300, '$360.00']],
  ];
  const r = Core.parseStatement([Core.buildPageLinesFromOcr(ocrPage(rows, 0))], {});
  assert.equal(r.merchant_name, 'Frugal Sam');
  assert.equal(r.address, '10 Oak Rd, Springfield, TN 37000');
});
