// Unit tests for public/scan-core.js using synthetic statements laid out like real processor formats.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Core = require('../public/scan-core.js');
const table = Core.loadTable(JSON.parse(fs.readFileSync(new URL('../public/data/appendix-g.json', import.meta.url), 'utf8')));

// rows: [[x, 'text'], [x, 'text'], ...] per line → page in the shape buildPageLines produces
const page = rows => ({ width: 612, lines: rows.map(r => ({ text: r.map(s => s[1]).join(' | '), segs: r.map(([x, t]) => ({ t, x })) })) });

test('buildPageLines groups PDF text items into lines and column segments', () => {
  const p = Core.buildPageLines([
    { str: 'Total', x: 40, y: 700, w: 30, h: 9 }, { str: 'Monthly Fees', x: 73, y: 700.5, w: 60, h: 9 },
    { str: '$347.21', x: 420, y: 700, w: 40, h: 9 }, { str: 'Next line', x: 40, y: 680, w: 50, h: 9 },
  ], 612);
  assert.equal(p.lines.length, 2);
  assert.equal(p.lines[0].text, 'Total Monthly Fees | $347.21');
  assert.deepEqual(p.lines[0].segs.map(s => s.t), ['Total Monthly Fees', '$347.21']);
});

test('tokens distinguish money, counts, percents and rates', () => {
  const t = Core.tokens('VI-US REGULATED (DB) | $8,570.04 38% | 130 | 42% 0.0005 | $0.220 | -$32.89');
  assert.deepEqual(t.filter(x => x.k === 'money').map(x => x.v), [8570.04, -32.89]);
  assert.deepEqual(t.filter(x => x.k === 'int').map(x => x.v), [130]);
  assert.deepEqual(t.filter(x => x.k === 'dec').map(x => x.v), [0.0005, 0.22]);
  assert.equal(Core.parseMoney('$(712.28)'), -712.28);
});

test('Payroc-style statement: DBA, location address, totals, card mix, itemized interchange', () => {
  const r = Core.parseStatement([page([
    [[392, 'Statement Date:'], [511, 'January 31, 2026']],
    [[392, 'Merchant Number:'], [506, '409100000000001']],
    [[31, 'Payroc LLC']], [[31, '100 Processor Way Suite 200']], [[30, 'Othertown, IL 60400']],
    [[31, 'Customer Service Direct:(888) 477-4510']],
    [[278, 'SAMPLE CAFE & GRILL']], [[31, 'Sample Holdings LLC']], [[278, 'Location address:']],
    [[31, '100 MAIN ST STE 2']], [[278, '100 MAIN ST STE 2']], [[31, 'MESA AZ 85202-9011'], [278, 'MESA AZ 85202-9011']],
    [[248, 'Processing Activity Summary']],
    [[40, 'Card Type'], [200, '# of Items'], [260, 'Total Items'], [320, 'Total Amount']],
    [[40, 'Visa Credit'], [200, '100'], [260, '100'], [320, '4,000.00'], [380, '0'], [420, '0.00'], [480, '4,000.00']],
    [[40, 'Visa Debit (sig)'], [200, '150'], [260, '150'], [320, '6,000.00'], [380, '0'], [420, '0.00'], [480, '6,000.00']],
    [[40, 'Total'], [200, '250'], [260, '250'], [320, '$10,000.00'], [380, '0'], [420, '$0.00'], [480, '$10,000.00']],
    [[40, 'Total Monthly Fees'], [480, '$320.00']],
  ]), page([
    [[40, 'Visa Interchange']],
    [[40, '# Items'], [200, 'Volume'], [300, 'Rate + Per Item'], [420, 'Interchange']],
    [[40, 'Retail Product 2 Signature Preferred'], [200, '60'], [260, '$2,500.00'], [330, '.0210+0.10'], [420, '$58.50']],
    [[40, 'Retail Traditional Rewards Product 2'], [200, '40'], [260, '$1,500.00'], [330, '.0165+0.10'], [420, '$28.75']],
    [[40, 'U.S. Regulated CPS Retail Check Card Debit'], [200, '150'], [260, '$6,000.00'], [330, '.0005+0.22'], [420, '$36.00']],
    [[40, 'Sub-Total Visa'], [420, '$123.25']],
  ])], { table });
  assert.equal(r.family, 'payroc');
  assert.equal(r.merchant_name, 'Sample Cafe & Grill');
  assert.equal(r.address, '100 Main St Ste 2, Mesa, AZ 85202');
  assert.equal(r.volume, 10000);
  assert.equal(r.transactions, 250);
  assert.equal(r.total_fees, 320);
  assert.deepEqual(r.card_mix.map(m => [m.brand, m.type, m.volume, m.count]), [['visa', 'credit', 4000, 100], ['visa', 'debit', 6000, 150]]);
  assert.equal(r.interchange_lines.length, 3);
  assert.deepEqual(r.interchange_lines.map(l => Core.matchProgram(table, l).program.pc), ['J58', 'J56', 'N09']);

  const m = Core.computeMarkup({ table, volume: r.volume, transactions: r.transactions, fees: r.total_fees, cardMix: r.card_mix, lines: r.interchange_lines });
  assert.equal(m.mode, 'itemized');
  assert.equal(m.interchange, 123.25);                 // Appendix G = billed interchange here
  assert.equal(m.interchangePadding, 0);
  assert.equal(m.assessments, 19);                     // 0.14% × 10,000 + $0.02 × 250
  assert.equal(m.trueCost, 142.25);
  assert.equal(m.markup, 177.75);
});

test('Fiserv-style statement: barcode line, owner name skipped, Location DBA and fees charged', () => {
  const r = Core.parseStatement([page([
    [[36, 'EXAMPLE ISO, 100 SAMPLE RD #210, OTHERTOWN, CA 90210']],
    [[40, 'YOUR CARD PROCESSING STATEMENT']],
    [[39, 'JANE OWNER'], [205, '400001'], [341, 'Page 1 of 4'], [427, 'THIS IS NOT A BILL']],
    [[11, 'COLR000F 0000 0000 000SAMPLE AUTO REPAIR LLC']],
    [[341, 'StatementPeriod'], [427, '07/01/26 - 07/31/26']],
    [[39, '12 OAK AVE']], [[341, 'Merchant Number'], [427, '9999 0000 0000000']], [[39, 'SPRINGFIELD CA 90001']],
    [[345, 'Location:']], [[359, 'SAMPLE AUTO']], [[11, '07 999999 PAGE 00001 OF 00002'], [359, '12 OAK AVE']], [[359, 'SPRINGFIELD CA 90001']],
    [[216, 'Page'], [248, '2'], [284, 'Amounts Submitted'], [531, '$50,000.00']],
    [[216, 'Page'], [248, '3'], [284, 'Fees Charged'], [533, '-$1,250.00']],
    [[40, 'SUMMARY BY CARD TYPE']], [[40, 'Total Gross Sales You Submitted'], [300, 'Refunds']],
    [[40, 'VISA'], [120, '$100.00'], [180, '300'], [240, '$30,000.00'], [300, '0'], [340, '0.00'], [400, '$30,000.00']],
    [[40, 'Visa Debit'], [120, '$50.00'], [180, '200'], [240, '$10,000.00'], [300, '0'], [340, '0.00'], [400, '$10,000.00']],
    [[40, 'MASTERCARD'], [120, '$100.00'], [180, '100'], [240, '$10,000.00'], [300, '0'], [340, '0.00'], [400, '$10,000.00']],
    [[40, 'Total'], [180, '600'], [240, '$50,000.00'], [300, '0'], [340, '0.00'], [400, '$50,000.00']],
  ])], { table });
  assert.equal(r.family, 'fiserv');
  assert.equal(r.merchant_name, 'Sample Auto');
  assert.equal(r.legal_name, 'Sample Auto Repair LLC');
  assert.equal(r.address, '12 Oak Ave, Springfield, CA 90001');
  assert.equal(r.volume, 50000);
  assert.equal(r.transactions, 600);
  assert.equal(r.total_fees, 1250);
  assert.deepEqual(r.card_mix.map(m => [m.brand, m.type]), [['visa', 'credit'], ['visa', 'debit'], ['mastercard', 'unknown']]);
});

test('TSYS plan-summary statement adds discount due and fees due', () => {
  const r = Core.parseStatement([page([
    [[40, 'Processing Month:'], [200, '04-26']],
    [[40, 'DBA Name:'], [200, 'SAMPLE SMOKE SHOP']],
    [[40, 'JOHN OWNER'], [300, 'Amount Deducted:']],
    [[40, '3712 PIKE RD STE B'], [300, '$ 411.50']],
    [[40, 'NASHVILLE TN 37211-3310']],
    [[40, 'Plan Summary']],
    [[40, 'VS'], [80, '307'], [140, '12,454.10'], [220, '00'], [260, '.00'], [300, '12,454.10'], [380, '40.57'], [440, '323.81']],
    [[40, 'VD'], [80, '2,234'], [140, '68,224.10'], [220, '00'], [260, '.00'], [300, '68,224.10'], [380, '30.54'], [440, '1,773.83']],
    [[40, '**'], [80, '2,541'], [140, '80,678.20'], [220, '00'], [260, '.00'], [300, '80,678.20'], [380, '31.75'], [440, '2,097.64']],
    [[40, 'Total Fees Due:'], [440, '411.50']],
    [[40, 'Discount Due'], [440, '2,097.64']],
    [[40, 'Fees Due'], [440, '411.50']],
  ])], { table });
  assert.equal(r.family, 'tsys');
  assert.equal(r.merchant_name, 'Sample Smoke Shop');
  assert.equal(r.address, '3712 Pike Rd Ste B, Nashville, TN 37211');
  assert.equal(r.volume, 80678.2);
  assert.equal(r.transactions, 2541);
  assert.equal(r.total_fees, 2509.14);
  assert.deepEqual(r.card_mix.map(m => [m.brand, m.type, m.count]), [['visa', 'credit', 307], ['visa', 'debit', 2234]]);
});

test('Clover billing statement: bill-to block, stacked totals, sale rows by brand', () => {
  const r = Core.parseStatement([page([
    [[40, '500 SAMPLE AVE']], [[40, 'OTHERTOWN, TX, 79400']], [[40, 'United States']],
    [[40, 'Bill to'], [330, 'Details']],
    [[40, 'Sample Thai Kitchen'], [330, 'Statement Number']],
    [[40, '100 Sample Pkwy #300'], [330, 'Issue date'], [420, 'Pending']],
    [[40, 'Springfield, TX, 75001'], [330, 'Payment terms'], [420, 'Auto-Draft']],
    [[40, 'Billing Account Number'], [330, '999900000000000']],
    [[40, 'Total Sales'], [330, 'Transaction Count']],
    [[40, '$20,000.00'], [330, '400']],
    [[40, 'Subtotal in USD:'], [330, '$880.00']],
    [[40, 'Amount Total:'], [330, '$880.00']],
    [[40, 'Sale: Non-Qualified, Visa, Credit'], [250, '250'], [300, '14,000.00'], [360, '3.85%'], [420, '--'], [480, '539.00']],
    [[40, 'Sale: Qualified, Visa, Debit'], [250, '150'], [300, '6,000.00'], [360, '3.85%'], [420, '--'], [480, '231.00']],
  ])], { table });
  assert.equal(r.family, 'clover_billing');
  assert.equal(r.merchant_name, 'Sample Thai Kitchen');
  assert.equal(r.address, '100 Sample Pkwy #300, Springfield, TX 75001');
  assert.equal(r.volume, 20000);
  assert.equal(r.transactions, 400);
  assert.equal(r.total_fees, 880);
  assert.deepEqual(r.card_mix.map(m => [m.brand, m.type, m.volume]), [['visa', 'credit', 14000], ['visa', 'debit', 6000]]);
});

test('Toast statement: fees collected plus adjustments, not capital repayments', () => {
  const r = Core.parseStatement([page([
    [[177, 'Statement Date: 7/31/23'], [319, 'Merchant ID:'], [392, '4440000000000']],
    [[177, 'Statement'], [245, '7/01/23 -'], [319, 'Merchant Name:'], [392, 'Sample Cantina - 200 Sample Rd']],
    [[319, 'Merchant'], [392, '200 Sample Rd #114']],
    [[319, 'Address:'], [392, 'Springfield, TX 78000']],
    [[43, 'Card Processing - Visa / MasterCard / Discover / Amex']],
    [[47, 'V/MC/D'], [95, '2.49% + 0.15'], [208, '1000 $50,000.00 0 $0.00 $1,395.00 $0.00'], [420, '$1,395.00 $8,000.00'], [520, '$40,605.00']],
    [[47, 'Amex'], [95, '3.29% + 0.15'], [160, '50'], [208, '$5,000.00'], [282, '0 $0.00 $172.00'], [330, '$0.00'], [372, '$172.00'], [420, '$700.00'], [520, '$4,128.00']],
    [[47, 'Total'], [100, '1050 $55,000.00 0'], [282, '$0.00'], [330, '$1,567.00'], [372, '-$0.02'], [420, '$1,566.98'], [470, '$8,700.00'], [520, '$44,733.02']],
  ])], { table });
  assert.equal(r.family, 'toast');
  assert.equal(r.merchant_name, 'Sample Cantina');
  assert.equal(r.address, '200 Sample Rd #114, Springfield, TX 78000');
  assert.equal(r.volume, 55000);
  assert.equal(r.transactions, 1050);
  assert.equal(r.total_fees, 1566.98);
});

test('scanned PDFs without a text layer are reported, not guessed', () => {
  const r = Core.parseStatement([{ width: 612, lines: [] }], { table });
  assert.equal(r.volume, null);
  assert.match(r.warnings[0], /No readable text/);
});

test('Appendix G program matching by exact name, rate, and code', () => {
  const byName = Core.matchProgram(table, { name: 'VI-US REGULATED (DB)', brand: 'visa', type: 'debit', volume: 8570.04, count: 130 });
  assert.equal(byName.program.pc, 'N01');
  assert.equal(byName.method, 'name');
  // Appendix G rate reproduces the interchange the statement billed for this program ($32.89)
  assert.equal(Math.round(((byName.program.rate / 100) * 8570.04 + byName.program.item * 130) * 100) / 100, 32.89);
  const byRate = Core.matchProgram(table, { name: 'Retail All Other Traditional Product 2', brand: 'visa', type: 'credit', rate: 1.51, item: 0.1 });
  assert.equal(byRate.program.pc, '023');
  const byCode = Core.matchProgram(table, { name: 'anything', brand: 'mastercard', type: 'credit', pc: '203' });
  assert.equal(byCode.program.name, 'MC-WORLD ELITE MERIT III');
});

test('computeMarkup estimates from card mix with default programs, Amex assumption, and 50/50 split', () => {
  const m = Core.computeMarkup({
    table, volume: 20000, transactions: 400, fees: 700,
    cardMix: [{ brand: 'visa', type: 'credit', volume: 10000, count: 200 }, { brand: 'mastercard', type: 'unknown', volume: 8000, count: 160 }, { brand: 'amex', type: 'credit', volume: 2000, count: 40 }],
  });
  assert.equal(m.mode, 'estimated');
  const byLabel = Object.fromEntries(m.rows.map(r => [r.label, r]));
  assert.equal(byLabel['Visa Credit'].program.pc, 'J58');
  assert.equal(Math.round(byLabel['Visa Credit'].cost * 100) / 100, 230);              // 2.10% × 10,000 + $0.10 × 200
  assert.equal(byLabel['Mastercard Credit (est. 50%)'].program.pc, '097');
  assert.equal(byLabel['Mastercard Debit (est. 50%)'].program.pc, 'N03');
  assert.equal(Math.round(byLabel['American Express'].cost * 100) / 100, 36);          // 1.60% × 2,000 + $0.10 × 40
  // agent override of a card program
  const o = Core.computeMarkup({ table, volume: 20000, transactions: 400, fees: 700, cardMix: [{ brand: 'visa', type: 'credit', volume: 20000, count: 400 }], overrides: { 'visa|credit': '023' } });
  assert.equal(o.rows[0].program.pc, '023');
  assert.equal(o.interchange, 342);                                                   // 1.51% × 20,000 + $0.10 × 400
  // no card mix → assumed mix, flagged
  assert.equal(Core.computeMarkup({ table, volume: 1000, transactions: 20, fees: 30 }).mixAssumed, true);
});

test('Appendix G data file is complete', () => {
  assert.equal(table.length, 1194);
  const brands = new Set(table.map(p => p.brand + '/' + p.type));
  assert.deepEqual([...brands].sort(), ['discover/credit', 'discover/debit', 'mastercard/credit', 'mastercard/debit', 'visa/credit', 'visa/debit']);
  assert.ok(table.every(p => typeof p.rate === 'number' && typeof p.item === 'number'));
});
