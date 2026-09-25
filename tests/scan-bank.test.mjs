// Bank statements through Scan Statement: detection, the three common layouts, and how transactions are sorted.
// All fixtures are synthetic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Core = require('../public/scan-core.js');

// rows: [[x, 'text', x2?], ...] → the page shape buildPageLines produces (y falls line by line)
const page = rows => ({
  width: 612,
  lines: rows.map((r, i) => ({ y: 740 - i * 12, text: r.map(s => s[1]).join(' | '), segs: r.map(([x, t, x2]) => ({ t, x, x2: x2 != null ? x2 : x + t.length * 4.5 })) })),
});
const R = (x2, t) => [x2 - t.length * 4.5, t, x2];   // right-aligned amount ending at x2

const header = [
  [[40, 'FIRST SAMPLE BANK']], [[40, 'PO Box 100']], [[40, 'Springfield, IL 62701']],
  [[40, 'SAMPLE BISTRO LLC']], [[40, '12 ELM ST']], [[40, 'SPRINGFIELD, TX 75001']],
  [[40, 'Statement Period 08/01/2026 through 08/31/2026']],
];

test('classifies bank transactions the way a merchant-services rep would', () => {
  const c = (d, dir) => Core.classifyBankTx(d, dir).category;
  assert.equal(c('Orig CO Name:Square Inc Orig ID:9424 Desc Date:260803 CO Entry Descr:Sq260803', 'credit'), 'card_deposit');
  assert.equal(c('BANKCARD 8076 DES:BTOT DEP ID:12345', 'credit'), 'card_deposit');
  assert.equal(c('BANKCARD 8076 DES:MTOT DISC ID:12345', 'debit'), 'processing_fee');
  assert.equal(c('AMEX EPAYMENT DES:ACH PMT', 'credit'), 'card_deposit');
  assert.equal(c('AMERICAN EXPRESS DES:ACH PMT', 'debit'), 'other_debit');       // paying its own Amex bill
  assert.equal(c('DISCOVER E-PAYMENT', 'debit'), 'other_debit');
  assert.equal(c('Square Inc SQ CAP 260803', 'debit'), 'mca_payment');
  assert.equal(c('TOAST INC DES:TOAST SUBSCR', 'debit'), 'software_fee');
  assert.equal(c('NORTHERN LEASING SYS', 'debit'), 'software_fee');
  assert.equal(c('LIBERTAS FUNDING DAILY', 'debit'), 'mca_payment');
  assert.equal(c('LIBERTAS FUNDING ADVANCE', 'credit'), 'mca_funding');
  assert.equal(c('NSF RETURNED ITEM FEE', 'debit'), 'misc_fee');
  assert.equal(c('Monthly Service Fee', 'debit'), 'misc_fee');
  assert.equal(c('CA Dept Tax Fee Cdtfa Epmt', 'debit'), 'other_debit');          // a tax payment, not a bank fee
  assert.equal(c('WORLDPAY FEE REFUND', 'credit'), 'other_deposit');
  assert.equal(c('HEARTLAND PYMT SYS CHARGEBACK', 'debit'), 'chargeback');
  assert.equal(c('ATM CASH DEPOSIT', 'credit'), 'other_deposit');
});

test('section layout (deposits / withdrawals headings): card volume, fees, cash advance', () => {
  const r = Core.parseStatement([page([
    ...header,
    [[40, 'CHECKING SUMMARY']], [[40, 'Beginning Balance'], R(570, '$5,000.00')], [[40, 'Deposits and Additions'], R(570, '12,400.00')],
    [[40, 'Electronic Withdrawals'], R(570, '-3,215.00')], [[40, 'Ending Balance'], R(570, '$14,185.00')],
    [[40, 'DEPOSITS AND ADDITIONS']], [[40, 'DATE'], [90, 'DESCRIPTION'], R(570, 'AMOUNT')],
    [[40, '08/03'], [90, 'Orig CO Name:Square Inc Orig ID:9424300002'], R(570, '4,000.00')], [[90, 'CO Entry Descr:Sq260803 Sec:CCD']],
    [[40, '08/10'], [90, 'Orig CO Name:Square Inc Orig ID:9424300002'], R(570, '6,000.00')],
    [[40, '08/12'], [90, 'Branch Deposit'], R(570, '2,400.00')],
    [[40, 'Total Deposits and Additions'], R(570, '$12,400.00')],
    [[40, 'ELECTRONIC WITHDRAWALS']], [[40, 'DATE'], [90, 'DESCRIPTION'], R(570, 'AMOUNT')],
    [[40, '08/04'], [90, 'Orig CO Name:Sample Funding LLC Daily ACH'], R(570, '150.00')],
    [[40, '08/05'], [90, 'Orig CO Name:Toast Inc Toast Subscr'], R(570, '165.00')],
    [[40, '08/06'], [90, 'Orig CO Name:Kapitus Servicing Pmt'], R(570, '400.00')],
    [[40, '08/07'], [90, 'Orig CO Name:Gusto Payroll'], R(570, '2,500.00')],
    [[40, 'Total Electronic Withdrawals'], R(570, '$3,215.00')],
  ])], {});
  assert.equal(r.document_type, 'bank_statement');
  assert.equal(r.merchant_name, 'Sample Bistro LLC');
  assert.equal(r.address, '12 Elm St, Springfield, TX 75001');
  assert.equal(r.volume, 10000);
  assert.equal(r.transactions, null);
  assert.equal(r.bank.card_deposits.count, 2);
  assert.deepEqual(r.bank.card_deposits.sources.map(s => s.name), ['Square']);
  assert.equal(r.bank.software_fees.total, 165);
  assert.equal(r.bank.mca_payments.total, 550);                                   // Kapitus plus an unlisted funder's daily debit
  assert.deepEqual(r.bank.mca_payments.sources.map(s => s.name).sort(), ['Kapitus', 'Sample Funding']);
  assert.equal(r.bank.credits_total, 12400);
  assert.equal(r.total_fees, 165);
});

test('column layout (Deposits/Credits and Withdrawals/Debits columns): direction comes from the column', () => {
  const r = Core.parseStatement([page([
    ...header,
    [[40, 'Beginning balance on 8/1'], R(570, '$1,000.00')], [[40, 'Deposits/Credits'], R(570, '8,000.00')], [[40, 'Withdrawals/Debits'], R(570, '- 520.00')], [[40, 'Ending balance on 8/31'], R(570, '$8,480.00')],
    [[40, 'Transaction history']],
    [[40, 'Date'], [90, 'Description'], R(430, 'Credits'), R(500, 'Debits'), R(575, 'balance')],
    [[40, '8/3'], [90, 'Bankcard-2231 Btot Dep 260803 Sample Bistro'], R(430, '8,000.00')],
    [[40, '8/4'], [90, '< Business to Business ACH Debit - Bankcard-2231 Mtot Disc'], R(500, '320.00'), R(575, '8,680.00')],
    [[40, '8/5'], [90, 'Monthly Service Fee'], R(500, '15.00')],
    [[40, '8/6'], [90, 'NORTHERN LEASING SYS EQUIP'], R(500, '185.00'), R(575, '8,480.00')],
    [[40, 'Ending daily balance']],
  ])], {});
  assert.equal(r.document_type, 'bank_statement');
  assert.equal(r.bank.card_deposits.total, 8000);
  assert.equal(r.bank.processing_fees.total, 320);
  assert.equal(r.bank.misc_fees.total, 15);
  assert.equal(r.bank.software_fees.total, 185);
  assert.equal(r.total_fees, 505);
});

test('signed layout: minus means debit, even after a description line that looks like a heading', () => {
  const r = Core.parseStatement([page([
    ...header,
    [[40, 'Beginning balance on August 1, 2026'], R(570, '$100.00')], [[40, 'Deposits'], R(570, '$1,500.00')], [[40, 'Purchases'], R(570, '-$60.00')], [[40, 'Ending balance on August 31, 2026'], R(570, '$1,540.00')],
    [[40, 'TRANSACTION DATE'], [120, 'DESCRIPTION'], R(480, 'AMOUNT'), R(560, 'BALANCE')],
    [[40, '8/02/2026'], [120, 'Stripe Transfer ST-1234'], R(480, '$1,000.00'), R(560, '$1,100.00')],
    [[40, '8/03/2026'], [120, 'Stripe Billing'], R(480, '-$60.00'), R(560, '$1,040.00')],
    [[120, 'PURCHASES']],
    [[40, '8/04/2026'], [120, 'Stripe Transfer ST-1235'], R(480, '$500.00'), R(560, '$1,540.00')],
  ])], {});
  assert.equal(r.bank.card_deposits.total, 1500);
  assert.equal(r.bank.software_fees.total, 60);
});

test('processing statements are not mistaken for bank statements', () => {
  const r = Core.parseStatement([page([
    [[40, 'YOUR CARD PROCESSING STATEMENT']], [[40, 'SAMPLE BISTRO LLC']], [[40, '12 ELM ST']], [[40, 'SPRINGFIELD, TX 75001']],
    [[40, 'Total Amount Submitted'], [400, '$12,000.00']], [[40, 'Total Fees Charged'], [400, '$360.00']],
    [[40, 'Deposits']], [[40, '08/03'], [120, 'Batch 1'], [400, '4,000.00']],
  ])], {});
  assert.equal(r.document_type, 'processing_statement');
  assert.equal(r.bank, undefined);
});

test('several monthly statements in one upload are averaged per month', () => {
  const month = (m, amt) => [
    [[40, 'Statement Period 0' + m + '/01/2026 through 0' + m + '/' + (m === 8 ? '31' : '30') + '/2026']],
    [[40, 'Beginning Balance'], R(570, m === 8 ? '$1,000.00' : '$2,000.00')], [[40, 'Deposits and Other Credits'], R(570, amt)], [[40, 'Ending Balance'], R(570, '$3,000.00')],
    [[40, 'Deposits and Other Credits']],
    [[40, m + '/05'], [90, 'HEARTLAND PYMT SYS TXNS'], R(570, amt)],
    [[40, 'Withdrawals and Other Debits']],
    [[40, m + '/06'], [90, 'HEARTLAND PYMT SYS FEES'], R(570, '100.00')],
  ];
  const r = Core.parseStatement([page([...header.filter(h => !/Statement Period/.test(h[0][1])), ...month(8, '9,000.00')]), page(month(9, '11,000.00'))], {});
  assert.equal(r.bank.months, 2);
  assert.equal(r.volume, 10000);
  assert.equal(r.total_fees, 100);
});

test('months come from the statement period, not the number of accounts on it', () => {
  assert.equal(Core._statementMonths('Statement Period: 03/01/2026 - 03/31/2026\nStatement Period: 03/01/2026 - 03/31/2026'), 1);
  assert.equal(Core._statementMonths('for August 1, 2026 to August 31, 2026\nYear to date 01/01/2026 - 08/31/2026'), 1);
  assert.equal(Core._statementMonths('Checking statement 2026-03-01 03/01/2026 - 05/31/2026'), 3);
  assert.equal(Core._statementMonths('LAST STATEMENT 07/08/25 ... 07/09/25 THROUGH 08/12/25'), 1);
  assert.equal(Core._statementMonths('no period printed'), 0);
  // two accounts (savings and checking) on one monthly statement
  const r = Core.parseStatement([page([
    ...header,
    [[40, 'REGULAR SHARE']], [[40, 'Beginning Balance'], R(570, '7,121.36')], [[40, 'Ending Balance'], R(570, '7,121.96')],
    [[40, 'BUSINESS CHECKING']], [[40, 'Beginning Balance'], R(570, '57,213.49')], [[40, 'Deposits and Other Credits'], R(570, '4,000.00')],
    [[40, '08/05'], [90, 'Deposit ACH TSYS/TRANSFIRST CR CD DEP'], R(570, '4,000.00')], [[40, 'Ending Balance'], R(570, '61,213.49')],
  ])], {});
  assert.equal(r.bank.months, 1);
  assert.equal(r.volume, 4000);
});

test('repeated identical debits to an unknown payee are flagged as a possible cash advance', () => {
  const rows = [];
  for (let d = 1; d <= 20; d++) rows.push([[40, '08/' + String(d).padStart(2, '0')], [90, 'ACH DEBIT QUICKSILVER CAP LLC'], R(570, '189.00')]);
  const r = Core.parseStatement([page([
    ...header, [[40, 'Beginning Balance'], R(570, '$9,000.00')], [[40, 'Ending Balance'], R(570, '$5,220.00')], [[40, 'Deposits and Other Credits'], R(570, '0.00')],
    [[40, 'Withdrawals and Other Debits']], ...rows,
  ])], {});
  assert.equal(r.bank.possible_mca.length, 1);
  assert.equal(r.bank.possible_mca[0].count, 20);
  assert.ok(r.warnings.some(w => /may be a cash advance/.test(w)));
});

test('lenders, returned items, wires and fee reversals are sorted the way a rep would', () => {
  const c = (d, dir) => Core.classifyBankTx(d, dir);
  assert.equal(c('Toast Inc Capital Rpmt 260804 Tcl-8841207', 'debit').category, 'mca_payment');
  assert.equal(c('ACH WITHDRAWAL SQUARE INC SQ LOAN PMT 260811', 'debit').category, 'mca_payment');
  assert.equal(c('SBA EIDL LOAN DES:PAYMENT', 'debit').category, 'mca_payment');
  assert.deepEqual(c('Orig CO Name:Sample Ridge Fnd Orig ID:1833 CO Entry Descr:Daily Pmt', 'debit'), { category: 'mca_payment', source: 'Sample Ridge Fnd' });
  assert.equal(c('FEDWIRE CREDIT FROM SAMPLE RIDGE FUNDING LLC', 'credit').category, 'mca_funding');
  assert.equal(c('External Withdrawal GIGGLE FINANCE GFIACH', 'debit').category, 'mca_payment');
  assert.equal(c('External Withdrawal PeopleFund Pymt - WEB PMTS (Rejected)', 'credit').category, 'other_deposit');   // a bounced payment, not new funding
  assert.equal(c('GUSTO PAYROLL FUNDING', 'debit').category, 'other_debit');
  assert.equal(c('Point Of Sale Withdrawal CARDIFF GIANT PIZZA CA', 'debit').category, 'other_debit');
  assert.equal(c('OUTGOING WIRE TO: HEARTLAND RESTAURANT EQUIP CO', 'debit').category, 'other_debit');
  assert.equal(c('WIRE TRANSFER FEE OUTGOING DOMESTIC WIRE', 'debit').category, 'misc_fee');
  assert.equal(c('Wire Trans Svc Charge - Sequence: 260826', 'debit').category, 'misc_fee');
  assert.equal(c('OVERDRAFT ITEM FEE ITEM PAID STRIPE TRANSFER 08/12', 'debit').category, 'misc_fee');
  assert.equal(c('Overdraft Fee for a Transaction Posted on 08/12 American Express ACH Pmt', 'debit').category, 'misc_fee');
  assert.equal(c('Deposited Item Returned Ck# 0000001047 Reason: Nsf', 'debit').category, 'other_debit');   // the customer's check, not a fee
  assert.equal(c('Deposited Item Returned Fee', 'debit').category, 'misc_fee');
  assert.equal(c('RETURNED DEPOSITED ITEM FEE REF 55', 'debit').category, 'misc_fee');
  assert.equal(c('BANKCARD 8076 DES:CHGBK REV ID:5182', 'credit').category, 'other_deposit');   // not card sales
  assert.equal(c('BANKCARD 8076 DES:MTOT ADJ ID:5182', 'credit').category, 'other_deposit');
  assert.equal(c('Orig CO Name:Bankcard-8076 CO Entry Descr:Chgbck', 'debit').category, 'chargeback');
  assert.equal(c('Orig CO Name:Square Inc CO Entry Descr:Sqsubscrip', 'debit').category, 'software_fee');
  assert.equal(c('ACH Debit WORLDPAY EQUIP RENT TERMINAL RENTAL', 'debit').category, 'software_fee');
  assert.equal(c('ACH CORP DEBIT PAYPAL MONTHLYFEE PAYMENTS PRO', 'debit').category, 'processing_fee');
});

test('rows printed with the date centered on a two- or three-line description', () => {
  // y falls 5 points per printed line: description above, date row, description below
  const rows = [
    [640, [[40, 'Post Date'], [100, 'Description'], R(406, 'Debits'), R(485, 'Credits'), R(577, 'Balance')]],
    [625, [[100, 'External Deposit BANKCARD DEP - MERCH DEP']]], [620, [[37, '08/01/2026'], R(485, '$2,150.40'), R(577, '$3,650.40')]], [615, [[100, '5550101']]],
    [605, [[100, 'External Withdrawal SAMPLE LENDING ACH']]], [600, [[37, '08/01/2026'], R(406, '$250.00'), R(577, '$3,400.40')]], [595, [[100, 'WEB PMTS']]],
    [585, [[100, 'Insufficient Funds Charge External Withdrawal']]], [580, [[37, '08/02/2026'], [100, '(Paid) SAMPLE PAYROLL NET 1001'], R(406, '$35.00'), R(577, '$3,365.40')]], [575, [[100, 'REF 2002']]],
    [565, [[100, 'NOW Deposit Zelle From SAMPLE PERSON']]], [560, [[37, '08/03/2026'], R(485, '$500.00'), R(577, '$3,865.40')]], [555, [[100, '+1-800-555-0100']]],
  ];
  const pg = { width: 612, lines: [...header.map((r, i) => ({ y: 760 - i * 10, text: r.map(s => s[1]).join(' | '), segs: r.map(([x, t]) => ({ t, x, x2: x + t.length * 4.5 })) })),
    { y: 690, text: 'Beginning Balance | $1,500.00', segs: [{ t: 'Beginning Balance', x: 40, x2: 120 }, { t: '$1,500.00', x: 530, x2: 570 }] },
    { y: 680, text: 'Ending Balance | $3,865.40', segs: [{ t: 'Ending Balance', x: 40, x2: 110 }, { t: '$3,865.40', x: 530, x2: 570 }] },
    ...rows.map(([y, r]) => ({ y, text: r.map(s => s[1]).join(' | '), segs: r.map(([x, t, x2]) => ({ t, x, x2: x2 != null ? x2 : x + t.length * 4.5 })) }))] };
  const tx = Core._bankTransactions([pg]);
  assert.deepEqual(tx.map(t => [t.category, t.amount]), [['card_deposit', 2150.4], ['other_debit', 250], ['misc_fee', 35], ['other_deposit', 500]]);
  assert.match(tx[2].desc, /^Insufficient Funds Charge External Withdrawal \(Paid\) SAMPLE PAYROLL/);
  assert.match(tx[3].desc, /^NOW Deposit Zelle/);
});

test('mainframe layout: description | date | amount rows, a deposit grid, and dashed headings', () => {
  const r = Core.parseStatement([page([
    ...header,
    [[330, 'LAST STATEMENT 07/07/26'], R(570, '50.00')], [[330, '5 CREDITS'], R(570, '1,353.00')], [[330, '2 DEBITS'], R(570, '364.20')], [[330, 'THIS STATEMENT 08/11/26'], R(570, '1,038.80')],
    [[40, 'MINIMUM BALANCE'], R(300, '55.00')],
    [[180, '- - - - - - - DEPOSITS - - - - - - -']],
    [[40, 'REF #.....DATE......AMOUNT REF #.....DATE......AMOUNT']],
    [[110, '07/09'], R(220, '450.00'), [320, '07/30'], R(430, '610.00')],
    [[110, '07/21'], R(220, '215.00'), [320, '08/05'], R(430, '75.00')],
    [[180, '- - - - - - OTHER CREDITS - - - - - -']],
    [[40, 'DESCRIPTION'], [470, 'DATE'], R(570, 'AMOUNT')],
    [[40, 'eStatement Credit'], [470, '08/12'], R(570, '3.00')],
    [[180, '- - - - - - OTHER DEBITS - - - - - -']],
    [[40, 'DESCRIPTION'], [470, 'DATE'], R(570, 'AMOUNT')],
    [[40, 'XX9999 PIN PURCHASE 07/10 12:55 SAMPLE MART'], [470, '07/10'], R(570, '64.20')], [[60, '00000000 111111']],
    [[40, 'XX9999 WITHDRAWAL 07/10 09:06 SAMPLE BANK'], [470, '07/10'], R(570, '300.00')],
  ])], {});
  assert.equal(r.document_type, 'bank_statement');
  assert.equal(r.bank.credits_total, 1353);
  assert.equal(r.bank.debits_total, 364.2);
  assert.equal(r.bank.months, 1);
});

test('a check list that repeats the register is not counted twice; check-number-first rows are read', () => {
  const r = Core.parseStatement([page([
    ...header,
    [[40, 'Beginning Balance'], R(570, '$5,000.00')], [[40, 'Ending Balance'], R(570, '$3,890.00')],
    [[40, 'Date'], [90, 'Description'], R(430, 'Debits'), R(500, 'Credits'), R(575, 'Balance')],
    [[40, '08/04'], [90, 'CHECK # 3101'], R(430, '$180.00'), R(575, '$4,820.00')],
    [[40, '08/05'], [90, 'CHECK # 3102'], R(430, '$245.50'), R(575, '$4,574.50')],
    [[40, 'Checks Cleared']],
    [[40, 'Check Nbr | Date | Amount | Check Nbr | Date | Amount']],
    [[40, '3101'], [70, '08/04'], R(160, '$180.00'), [200, '3102'], [230, '08/05'], R(320, '$245.50')],
    [[40, 'CHECKS PAID']],
    [[40, 'CHECK NO.'], [90, 'DESCRIPTION'], [440, 'DATE PAID'], R(575, 'AMOUNT')],
    [[40, '1052 ^'], [440, '08/05'], R(575, '684.50')],
  ])], {});
  const checks = Core._bankTransactions([page([
    [[40, 'CHECKS PAID']], [[40, 'CHECK NO.'], [90, 'DESCRIPTION'], [440, 'DATE PAID'], R(575, 'AMOUNT')], [[40, '1052 ^'], [440, '08/05'], R(575, '684.50')],
  ])]);
  assert.deepEqual(checks.map(t => [t.desc, t.dir, t.amount]), [['Check 1052', 'debit', 684.5]]);
  assert.equal(r.bank.debits_total, 1110);
});

test('OCR page numbers like "Page | 10of7" mark the first page, so a later "Page 1 of 2" disclosure is not taken for it', () => {
  const stmt = page([[[400, 'Page'], [440, '10of7']], ...header, [[40, 'Beginning Balance'], R(570, '$1,000.00')], [[40, 'Deposits and Other Credits'], R(570, '0.00')], [[40, 'Ending Balance'], R(570, '$1,000.00')]]);
  const disclosure = page([[[400, 'Page 1 of2'], [440, 'Funds Availability Policy Disclosure']], [[40, 'SAMPLE BANK']], [[40, 'PO BOX 9']], [[40, 'OTHERTOWN, TX 75002']]]);
  const r = Core.parseStatement([stmt, disclosure], {});
  assert.equal(r.merchant_name, 'Sample Bistro LLC');
});

test('a payment or fee credited back is not counted as a cost', () => {
  const r = Core.parseStatement([page([
    ...header,
    [[40, 'Beginning Balance'], R(570, '$2,000.00')], [[40, 'Ending Balance'], R(570, '$1,465.00')],
    [[40, 'Date'], [90, 'Description'], R(430, 'Debits'), R(500, 'Credits'), R(575, 'Balance')],
    [[40, '08/06'], [90, 'External Withdrawal SAMPLE FUNDING Pymt - WEB PMTS'], R(430, '$1,200.00'), R(575, '$800.00')],
    [[40, '08/06'], [90, 'External Withdrawal SAMPLE FUNDING Pymt - WEB PMTS (Rejected)'], R(500, '$1,200.00'), R(575, '$2,000.00')],
    [[40, '08/06'], [90, 'Insufficient Funds Charge (Returned) SAMPLE FUNDING Pymt'], R(430, '$35.00'), R(575, '$1,965.00')],
    [[40, '08/07'], [90, 'Insufficient Funds Charge CK # 3101 (Paid)'], R(430, '$35.00'), R(575, '$1,930.00')],
    [[40, '08/09'], [90, 'Reversed Paid Insufficient Fee courtesy'], R(500, '$35.00'), R(575, '$1,965.00')],
    [[40, '08/10'], [90, 'External Withdrawal SAMPLE FUNDING Pymt - WEB PMTS'], R(430, '$500.00'), R(575, '$1,465.00')],
  ])], {});
  assert.equal(r.bank.mca_payments.total, 500);
  assert.equal(r.bank.misc_fees.total, 35);
});

test('more wording from real statements', () => {
  const c = (d, dir) => Core.classifyBankTx(d, dir).category;
  assert.equal(c('Square Inc SQ CAP8491 Sample Bistro', 'debit'), 'mca_payment');
  assert.equal(c('Square Inc Sq Cap0036 Sample Bistro', 'credit'), 'mca_funding');              // Square Capital proceeds, not card sales
  assert.equal(c('WT Fed#01234 Webbank /Org=1/Webbank/Paypal Srf# A0000', 'credit'), 'mca_funding');
  assert.equal(c('CAPITAL RESOURCE DES:0000 ID:0304 INDN:SAMPLE BISTRO', 'debit'), 'mca_payment');
  assert.equal(c('CLOVER FEES DES:CLOVER FEE ID:0000 INDN:SAMPLE BISTRO', 'debit'), 'software_fee');
  assert.equal(c('Business to Business ACH Debit - Intuit 0000 Acct Fee 1111', 'debit'), 'processing_fee');
  assert.equal(c('MERCH 1234567 SAMPLE TOWN BILLING', 'debit'), 'processing_fee');
  assert.equal(c('MERCH 1234567 SAMPLE TOWN DEPOSIT', 'credit'), 'card_deposit');
  assert.equal(c('External Deposit Tekmetric Paymen - Tekmetric ST-000', 'credit'), 'card_deposit');
  assert.equal(c('Point Of Sale Withdrawal TEKMETRIC TEKMETRIC.COM TXUS', 'debit'), 'software_fee');
  assert.equal(c('Cash Deposit Processing Fee', 'debit'), 'misc_fee');
  assert.equal(c('Transactions Fee', 'debit'), 'misc_fee');
  assert.equal(c('SAMPLE ATM 03/08 000000 WITHDRWL SAMPLE ATM TOWN CA FEE', 'debit'), 'misc_fee');
  assert.equal(c('ACH-SERVICEFEE PMNTUS SVC FEE', 'debit'), 'other_debit');                       // a biller's convenience fee
});

test('statement-wide patterns: PayPal loan debits, settlements under the business name, glued margin codes', () => {
  const rows = [];
  for (let d = 1; d <= 22; d++) if (d % 7 !== 6 && d % 7 !== 0) rows.push([[40, '08/' + String(d).padStart(2, '0')], [90, 'Sample Bistro/1234567890 F' + (5000 + d) + ' Sample Bistro LLC'], R(570, (300 + d * 17.31).toFixed(2))]);
  const r = Core.parseStatement([page([
    ...header,
    [[40, 'Beginning Balance'], R(570, '$1,000.00')], [[40, 'Ending Balance'], R(570, '$9,000.00')],
    [[40, 'Deposits and Other Credits']], ...rows, [[40, '08/12'], [90, 'Deposit'], R(570, '480.00')],
    [[40, 'Withdrawals and Other Debits']],
    [[40, '08/04'], [90, 'Business to Business ACH Debit - Paypal Debit R0001'], R(570, '770.59-')],
    [[40, '08/11'], [90, 'Business to Business ACH Debit - Paypal Debit R0002'], R(570, '770.59-')],
    [[40, '08/12'], [90, 'Paypal Inst Xfer Sample Supplies'], R(570, '154.20-')],
    [[20, '6250SAMPLE08/15/26 OVERDRAFT ITEM FEE']], [[560, '20.00-']],
    [[40, '08/31/26 Service Charge'], R(570, '5.60-SC')],
  ])], {});
  assert.equal(r.bank.card_deposits.count, rows.length);
  assert.ok(r.warnings.some(w => /business’s own name/.test(w)));
  assert.equal(r.bank.mca_payments.total, 1541.18);
  assert.equal(r.bank.misc_fees.total, 25.6);
});
