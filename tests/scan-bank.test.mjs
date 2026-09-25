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
  assert.equal(c('Orig CO Name:Square Inc Orig ID:9000 Desc Date:260803 CO Entry Descr:Sq260803', 'credit'), 'card_deposit');
  assert.equal(c('BANKCARD 1234 DES:BTOT DEP ID:12345', 'credit'), 'card_deposit');
  assert.equal(c('BANKCARD 1234 DES:MTOT DISC ID:12345', 'debit'), 'processing_fee');
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
    [[40, '08/03'], [90, 'Orig CO Name:Square Inc Orig ID:9000000002'], R(570, '4,000.00')], [[90, 'CO Entry Descr:Sq260803 Sec:CCD']],
    [[40, '08/10'], [90, 'Orig CO Name:Square Inc Orig ID:9000000002'], R(570, '6,000.00')],
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
    [[40, '8/3'], [90, 'Bankcard-1111 Btot Dep 260803 Sample Bistro'], R(430, '8,000.00')],
    [[40, '8/4'], [90, '< Business to Business ACH Debit - Bankcard-1111 Mtot Disc'], R(500, '320.00'), R(575, '8,680.00')],
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
  assert.equal(Core._statementMonths('LAST STATEMENT 06/09/26 ... 06/10/26 THROUGH 07/13/26'), 1);
  assert.equal(Core._statementMonths('no period printed'), 0);
  // two accounts (savings and checking) on one monthly statement
  const r = Core.parseStatement([page([
    ...header,
    [[40, 'REGULAR SHARE']], [[40, 'Beginning Balance'], R(570, '3,500.00')], [[40, 'Ending Balance'], R(570, '3,500.40')],
    [[40, 'BUSINESS CHECKING']], [[40, 'Beginning Balance'], R(570, '42,000.00')], [[40, 'Deposits and Other Credits'], R(570, '4,000.00')],
    [[40, '08/05'], [90, 'Deposit ACH TSYS/TRANSFIRST CR CD DEP'], R(570, '4,000.00')], [[40, 'Ending Balance'], R(570, '46,000.00')],
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
  assert.equal(c('Toast Inc Capital Rpmt 260804 Tcl-0000000', 'debit').category, 'mca_payment');
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
  assert.equal(c('Deposited Item Returned Ck# 0000000000 Reason: Nsf', 'debit').category, 'other_debit');   // the customer's check, not a fee
  assert.equal(c('Deposited Item Returned Fee', 'debit').category, 'misc_fee');
  assert.equal(c('RETURNED DEPOSITED ITEM FEE REF 55', 'debit').category, 'misc_fee');
  assert.equal(c('BANKCARD 1234 DES:CHGBK REV ID:0000', 'credit').category, 'other_deposit');   // not card sales
  assert.equal(c('BANKCARD 1234 DES:MTOT ADJ ID:0000', 'credit').category, 'other_deposit');
  assert.equal(c('Orig CO Name:Bankcard-1234 CO Entry Descr:Chgbck', 'debit').category, 'chargeback');
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
    [[330, 'LAST STATEMENT 07/03/26'], R(570, '50.00')], [[330, '5 CREDITS'], R(570, '1,352.00')], [[330, '2 DEBITS'], R(570, '364.20')], [[330, 'THIS STATEMENT 08/14/26'], R(570, '1,037.80')],
    [[40, 'MINIMUM BALANCE'], R(300, '55.00')],
    [[180, '- - - - - - - DEPOSITS - - - - - - -']],
    [[40, 'REF #.....DATE......AMOUNT REF #.....DATE......AMOUNT']],
    [[110, '07/09'], R(220, '450.00'), [320, '07/30'], R(430, '610.00')],
    [[110, '07/21'], R(220, '215.00'), [320, '08/05'], R(430, '75.00')],
    [[180, '- - - - - - OTHER CREDITS - - - - - -']],
    [[40, 'DESCRIPTION'], [470, 'DATE'], R(570, 'AMOUNT')],
    [[40, 'eStatement Credit'], [470, '08/12'], R(570, '2.00')],
    [[180, '- - - - - - OTHER DEBITS - - - - - -']],
    [[40, 'DESCRIPTION'], [470, 'DATE'], R(570, 'AMOUNT')],
    [[40, 'XX9999 PIN PURCHASE 07/10 11:11 SAMPLE MART'], [470, '07/10'], R(570, '64.20')], [[60, '00000000 111111']],
    [[40, 'XX9999 WITHDRAWAL 07/10 10:10 SAMPLE BANK'], [470, '07/10'], R(570, '300.00')],
  ])], {});
  assert.equal(r.document_type, 'bank_statement');
  assert.equal(r.bank.credits_total, 1352);
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
  assert.equal(c('Square Inc SQ CAP0001 Sample Bistro', 'debit'), 'mca_payment');
  assert.equal(c('Square Inc Sq Cap0002 Sample Bistro', 'credit'), 'mca_funding');              // Square Capital proceeds, not card sales
  assert.equal(c('WT Fed#01234 Webbank /Org=1/Webbank/Paypal Srf# A0000', 'credit'), 'mca_funding');
  assert.equal(c('CAPITAL RESOURCE DES:0000 ID:0000 INDN:SAMPLE BISTRO', 'debit'), 'mca_payment');
  assert.equal(c('CLOVER FEES DES:CLOVER FEE ID:0000 INDN:SAMPLE BISTRO', 'debit'), 'software_fee');
  assert.equal(c('Business to Business ACH Debit - Intuit 0000 Acct Fee 1111', 'debit'), 'processing_fee');
  assert.equal(c('MERCH 1234567 SAMPLE TOWN BILLING', 'debit'), 'processing_fee');
  assert.equal(c('MERCH 1234567 SAMPLE TOWN DEPOSIT', 'credit'), 'card_deposit');
  assert.equal(c('External Deposit Tekmetric Paymen - Tekmetric ST-000', 'credit'), 'card_deposit');
  assert.equal(c('Point Of Sale Withdrawal TEKMETRIC TEKMETRIC.COM TXUS', 'debit'), 'software_fee');
  assert.equal(c('Cash Deposit Processing Fee', 'debit'), 'misc_fee');
  assert.equal(c('Transactions Fee', 'debit'), 'misc_fee');
  assert.equal(c('SAMPLE ATM 08/14 000000 WITHDRWL SAMPLE ATM TOWN CA FEE', 'debit'), 'misc_fee');
  assert.equal(c('ACH-SERVICEFEE PMNTUS SVC FEE', 'debit'), 'other_debit');                       // a biller's convenience fee
});

test('statement-wide patterns: PayPal loan debits, settlements under the business name, glued margin codes', () => {
  const rows = [];
  for (let d = 1; d <= 22; d++) if (d % 7 !== 6 && d % 7 !== 0) rows.push([[40, '08/' + String(d).padStart(2, '0')], [90, 'Sample Bistro/1234567890 F' + (5000 + d) + ' Sample Bistro LLC'], R(570, (300 + d * 16.83).toFixed(2))]);
  const r = Core.parseStatement([page([
    ...header,
    [[40, 'Beginning Balance'], R(570, '$1,000.00')], [[40, 'Ending Balance'], R(570, '$9,000.00')],
    [[40, 'Deposits and Other Credits']], ...rows, [[40, '08/12'], [90, 'Deposit'], R(570, '480.00')],
    [[40, 'Withdrawals and Other Debits']],
    [[40, '08/04'], [90, 'Business to Business ACH Debit - Paypal Debit R0001'], R(570, '612.40-')],
    [[40, '08/11'], [90, 'Business to Business ACH Debit - Paypal Debit R0002'], R(570, '612.40-')],
    [[40, '08/12'], [90, 'Paypal Inst Xfer Sample Supplies'], R(570, '154.20-')],
    [[20, '9999SAMPLE08/15/26 OVERDRAFT ITEM FEE']], [[560, '20.00-']],
    [[40, '08/31/26 Service Charge'], R(570, '4.25-SC')],
  ])], {});
  assert.equal(r.bank.card_deposits.count, rows.length);
  assert.ok(r.warnings.some(w => /business’s own name/.test(w)));
  assert.equal(r.bank.mca_payments.total, 1224.8);
  assert.equal(r.bank.misc_fees.total, 24.25);
});

test('Chase-style scan details: fees section, processor capital, check lists, OCR headings', () => {
  const c = (d, dir) => Core.classifyBankTx(d, dir);
  assert.deepEqual(c('Orig CO Name:360 Payments CAP Orig ID:9000000000 Desc Date:260822 CO Entry Descr:2026-08-21Sec:CCD', 'debit'), { category: 'mca_payment', source: '360 Payments Capital' });
  assert.equal(c('Orig CO Name:360Payments Orig ID:9000000000 Desc Date:260809 CO Entry Descr:8005550100Sec:CCD', 'debit').category, 'processing_fee');
  assert.equal(c('Orig CO Name:Sample Billing Orig ID:1000000000 Desc Date: Inv CO Entry Descr:Funding Sec:CCD', 'credit').category, 'other_deposit');   // a payer's memo, not a lender
  assert.equal(c('Orig CO Name:Timepaymentcorp_ Orig ID:9000000000 CO Entry Descr:Web Pmts Sec:Web', 'debit').category, 'software_fee');
  const r = Core.parseStatement([page([
    ...header,
    [[40, 'Beginning Balance'], R(570, '$10,000.00')], [[40, 'Deposits and Additions'], R(570, '3,000.00')], [[40, 'Ending Balance'], R(570, '$12,402.60')],
    [[40, '[DEPOSITS AND ADDITIONS] (rinse?']], [[40, 'DATE'], [90, 'DESCRIPTION'], R(570, 'AMOUNT')],
    [[40, '08/03'], [90, 'Orig CO Name:Bankcard Orig ID:1000000000 CO Entry Descr:Settlementsec:CCD'], R(570, '3,000.00')],
    [[40, 'CHECKS PAID]']], [[40, 'CHECK NO.'], [90, 'DESCRIPTION'], [440, 'DATE PAID'], R(575, 'AMOUNT')],
    [[40, '3101'], [440, '08/12'], R(575, '$87.40')],
    [[40, '3102'], [390, '08/05'], [440, '08/05'], R(575, '310.00')],
    [[40, '3103 A'], [440, '08/21'], R(575, '140.00')],
    [[40, 'Deposit']],
    [[40, 'FEES']], [[40, 'DATE'], [90, 'DESCRIPTION'], R(570, 'AMOUNT')],
    [[40, '08/04'], [90, 'Same Day Payment - Standard'], R(570, '$12.00')],
    [[40, '08/04'], [90, 'Deposited Items Bundle'], R(570, '18.00')],
    [[40, '08/31'], [90, 'Monthly Service Fee'], R(570, '30.00')],
  ])], {});
  assert.equal(r.bank.card_deposits.total, 3000);
  assert.equal(r.bank.debits_total, 597.4);
  assert.equal(r.bank.misc_fees.total, 60);
  assert.equal(r.bank.reconcile_gap, 0);
  assert.ok(!r.warnings.some(w => /misread/.test(w)));
});

test('U.S. Bank-style grids with month-name dates and reference numbers', () => {
  const r = Core.parseStatement([page([
    ...header,
    [[40, 'Beginning Balance'], R(570, '$1,000.00')], [[40, 'Customer Deposits'], [330, '2'], R(570, '18,515.00')], [[40, 'Checks Paid'], [330, '2'], R(570, '6,250.00-')], [[40, 'Ending Balance'], R(570, '$13,265.00')],
    [[40, 'Customer Deposits']],
    [[40, 'Number | Date | Ref Number | Amount | Number | Date | Ref Number | Amount']],
    [[40, 'Jul 6'], [120, '8400000001'], R(260, '9,875.00'), [300, 'Jul 20'], [380, '8400000002'], R(520, '8,640.00')],
    [[40, 'Checks Presented Conventionally']],
    [[40, 'Check | Date | Ref Number | Amount | Check | Date | Ref Number | Amount']],
    [[40, '0101'], [80, 'Jul'], [100, '8'], [120, '8400000003'], R(260, '5,000.00'), [300, '20017*'], [340, 'Jul'], [360, '8'], [380, '8400000004'], R(520, '1,250.00')],
  ])], {});
  assert.equal(r.bank.credits_total, 18515);
  assert.equal(r.bank.debits_total, 6250);
  assert.equal(r.bank.reconcile_gap, 0);
});

test('amounts that do not reconcile with the statement are flagged for the agent', () => {
  const r = Core.parseStatement([page([
    ...header,
    [[40, 'Beginning Balance'], R(570, '$1,000.00')], [[40, 'Deposits and Additions'], R(570, '2,000.00')], [[40, 'Ending Balance'], R(570, '$3,000.00')],
    [[40, 'DEPOSITS AND ADDITIONS']], [[40, '08/03'], [90, 'Orig CO Name:Bankcard CO Entry Descr:Settlement'], R(570, '2,550.00')],   // a misread 2,000.00
  ])], {});
  assert.ok(r.warnings.some(w => /add up to \$2550\.00, but the statement’s total is \$2000\.00/.test(w)), r.warnings.join(' | '));
});

test('review findings: names inside descriptors and look-alike wording are not misread', () => {
  const c = (d, dir) => Core.classifyBankTx(d, dir).category;
  // the account holder's own name ("INDN:CAPITAL CITY DINER") says nothing about the payee
  assert.equal(c('HEARTLAND PAYMENT DES:TXNS/FEES ID:65000 INDN:CAPITAL CITY DINER CO ID:1234', 'debit'), 'processing_fee');
  assert.equal(c('BANKCARD 1234 DES:MTOT DISC ID:12345 INDN:CAPITAL PLUMBING LLC', 'debit'), 'processing_fee');
  assert.equal(c('ACH DEBIT SAMPLE SUPPLY DES:INVOICE INDN:TOAST HOUSE CAFE', 'debit'), 'other_debit');
  assert.equal(c('SPECTRUM DES:ONE TIME PAYMENT', 'debit'), 'other_debit');
  assert.equal(c('SUNBELT EQUIPMENT RENTAL DES:ACH', 'debit'), 'other_debit');
  assert.equal(c('FIRST BANKCARD DES:ONLINE PMT ID:998877', 'debit'), 'other_debit');       // paying a credit card
  assert.equal(c('US BANK DES:BANKCARD PMT', 'debit'), 'other_debit');
  assert.equal(c('CLOVER SONOMA DES:ACH DEBIT', 'debit'), 'other_debit');                    // a dairy, not Clover POS
  assert.equal(c('MAVERICK ROOFING SUPPLY DES:ACH', 'debit'), 'other_debit');
  assert.equal(c('SQUARE ONE DISTRIBUTING DES:PAYMENT', 'credit'), 'other_deposit');
  assert.equal(c('ACH RETURN BANKCARD 1234 DES:MTOT DISC', 'credit'), 'other_deposit');
  assert.equal(c('ACH RETURN KAPITUS SERVICING DAILY PMT', 'credit'), 'other_deposit');
  assert.equal(c('SHIFT4 PAYMENTS DES:FUNDING ID:123', 'credit'), 'card_deposit');            // a processor payout
  assert.equal(c('GREENBOX POS DES:DEPOSIT', 'credit'), 'other_deposit');
  assert.equal(c('SUMMIT FUNDING INC DES:MTG PMT', 'debit'), 'other_debit');                  // a mortgage
  assert.equal(c('PARKVIEW PLAZA LLC DES:RENT', 'debit'), 'other_debit');
  assert.equal(c('DISCOVER BANK DES:TRANSFER ID:123', 'credit'), 'other_deposit');            // the owner's savings
  assert.equal(c('RETURN ITEM FEE', 'debit'), 'misc_fee');
  assert.equal(c('DEPOSITED ITEM RETURN FEE', 'debit'), 'misc_fee');
});

test('review findings: credit card statements, months, netting and repeat-debit grouping', () => {
  const card = page([
    [[40, 'SAMPLE BUSINESS CARD']], ...header.slice(3),
    [[40, 'Previous Balance'], R(570, '$1,000.00')], [[40, 'New Balance'], R(570, '$4,120.00')], [[40, 'Minimum Payment Due'], R(570, '$40.00')],
    [[40, 'Payment Due Date 09/25/2026']], [[40, 'Credit Limit'], R(570, '$10,000.00')], [[40, 'Available Credit'], R(570, '$5,880.00')],
    [[40, 'We use the Average Daily Balance (including new purchases) method']],
    [[40, '08/03'], [90, 'SQ *SAMPLE RESTAURANT SUPPLY'], R(570, '1,200.00')],
  ]);
  assert.notEqual(Core.parseStatement([card], {}).document_type, 'bank_statement');
  // one statement listing checking and savings is one month
  const two = Core.parseStatement([page([
    ...header.slice(0, 6), [[40, 'Statement Period: August 1 - August 31, 2026']],
    [[40, 'BUSINESS CHECKING']], [[40, 'Beginning Balance'], R(570, '$5,000.00')], [[40, 'Deposits and Other Credits'], R(570, '10,000.00')],
    [[40, '08/05'], [90, 'Orig CO Name:Square Inc Sq260805'], R(570, '10,000.00')], [[40, 'Ending Balance'], R(570, '$15,000.00')],
    [[40, 'BUSINESS SAVINGS']], [[40, 'Beginning Balance'], R(570, '$20,000.00')], [[40, 'Ending Balance'], R(570, '$20,000.00')],
  ])], {});
  assert.equal(two.bank.months, 1);
  assert.equal(two.volume, 10000);
  // an unrelated refund of the same amount doesn't cancel a lender payment
  const rows = [];
  for (let d = 3; d <= 7; d++) rows.push([[40, '08/0' + d], [90, 'LIBERTAS FUNDING DAILY ACH'], R(570, '250.00')]);
  const r = Core.parseStatement([page([
    ...header, [[40, 'Beginning Balance'], R(570, '$5,000.00')], [[40, 'Ending Balance'], R(570, '$4,000.00')],
    [[40, 'Deposits and Other Credits']], [[40, '08/20'], [90, 'SAMPLE HARDWARE REFUND'], R(570, '250.00')],
    [[40, 'Withdrawals and Other Debits']], ...rows,
    [[40, '08/11'], [90, 'Purchase authorized on 08/10 SAMPLE GAS STATION'], R(570, '100.00')], [[40, '08/12'], [90, 'Purchase authorized on 08/11 SAMPLE HARDWARE'], R(570, '100.00')],
    [[40, '08/13'], [90, 'Purchase authorized on 08/12 SAMPLE FOODS'], R(570, '100.00')], [[40, '08/14'], [90, 'Purchase authorized on 08/13 SAMPLE MARKET'], R(570, '100.00')],
    [[40, '08/15'], [90, 'PAYPAL TRANSFER ADD TO BALANCE WEB ID: PAYPALSD11'], R(570, '500.00')], [[40, '08/19'], [90, 'PAYPAL TRANSFER ADD TO BALANCE WEB ID: PAYPALSD11'], R(570, '500.00')],
  ])], {});
  assert.equal(r.bank.mca_payments.total, 1250);
  assert.ok(!r.warnings.some(w => /returned unpaid|Purchase Authorized/i.test(w)), r.warnings.join(' | '));
});

test('review findings: row assembly across statements, columns and headings', () => {
  const colPage = (headers, rows, extra) => page([...header, [[40, 'Beginning Balance'], R(570, '$1,000.00')], [[40, 'Ending Balance'], R(570, '$8,480.00')], ...(extra || []),
    [[40, 'Date'], [90, 'Description'], R(430, headers[0]), R(500, headers[1]), R(575, 'Balance')], ...rows]);
  const rows = [[[40, '8/3'], [90, 'BANKCARD 1234 BTOT DEP'], R(430 + 70, '8,000.00')], [[40, '8/4'], [90, 'BANKCARD 1234 MTOT DISC'], R(430, '320.00')], [[40, '8/5'], [90, 'NORTHERN LEASING SYS'], R(430, '200.00')]];
  for (const h of [['Withdrawal Amount', 'Deposit Amount'], ['Debit Amount', 'Credit Amount'], ['Money Out', 'Money In'], ['Debits (-)', 'Credits (+)']]) {
    const r = Core.parseStatement([colPage(h, rows)], {});
    assert.equal(r.bank.card_deposits.total, 8000, h.join('/'));
    assert.equal(r.bank.processing_fees.total, 320, h.join('/'));
  }
  // an account-summary header (labels with amounts beneath) is not the register's column map
  const sumHead = [[[100, 'Beginning Balance'], R(330, 'Deposits/Credits'), R(450, 'Withdrawals/Debits'), R(570, 'Ending Balance')], [R(200, '1,000.00'), R(330, '8,000.00'), R(450, '320.00'), R(570, '8,680.00')]];
  const signed = Core.parseStatement([page([...header, ...sumHead, [[40, 'DATE'], [90, 'DESCRIPTION'], R(480, 'AMOUNT'), R(560, 'BALANCE')],
    [[40, '08/03'], [90, 'BANKCARD 1234 DES:BTOT DEP'], R(480, '8,000.00'), R(560, '9,000.00')], [[40, '08/04'], [90, 'BANKCARD 1234 DES:MTOT DISC'], R(480, '-320.00'), R(560, '8,680.00')]])], {});
  assert.equal(signed.bank.card_deposits.total, 8000);
  assert.equal(signed.bank.processing_fees.total, 320);
  // the amount column, not a figure inside the description
  const od = Core.parseStatement([page([...header, [[40, 'Beginning Balance'], R(570, '$1,500.00')], [[40, 'Deposits'], R(570, '$0.00')], [[40, 'Withdrawals'], R(570, '-$34.00')], [[40, 'Ending Balance'], R(570, '$1,466.00')],
    [[40, 'TRANSACTION DATE'], [120, 'DESCRIPTION'], R(480, 'AMOUNT'), R(560, 'BALANCE')],
    [[40, '08/05'], [120, 'Overdraft Fee For A $52.00 Card Purchase - Details: 0804 Sq *Sample Coffee'], R(480, '-34.00'), R(560, '1,466.00')]])], {});
  assert.equal(od.bank.misc_fees.total, 34);
  assert.equal(od.bank.card_deposits.total, 0);
  // commas in headings; "ATM Withdrawal" inside a section is a description, not a heading
  const bbt = Core.parseStatement([page([...header, [[40, 'Beginning Balance'], R(570, '$1,000.00')], [[40, 'Ending Balance'], R(570, '$11,675.00')],
    [[40, 'Other withdrawals, debits and service charges']], [[40, '08/04'], [90, 'BANKCARD 1234 MTOT DISC'], R(570, '320.00')],
    [[40, 'Deposits, credits and interest']], [[40, '08/03'], [90, 'BANKCARD 1234 BTOT DEP'], R(570, '12,000.00')], [[90, 'ATM Withdrawal']],
    [[40, '08/06'], [90, 'BANKCARD 1234 BTOT DEP'], R(570, '1,000.00')]])], {});
  assert.equal(bbt.bank.card_deposits.total, 13000);
  assert.equal(bbt.bank.processing_fees.total, 320);
  // two PDFs: the second statement's layout doesn't inherit the first one's columns
  const a = colPage(['Debits', 'Credits'], [[[40, '8/3'], [90, 'BANKCARD 1234 BTOT DEP'], R(500, '8,000.00')]]); a.doc = 0;
  const b = page([...header, [[40, 'Beginning balance on August 1, 2026'], R(570, '$100.00')], [[40, 'Deposits'], R(570, '$1,500.00')], [[40, 'Ending balance on August 31, 2026'], R(570, '$1,600.00')],
    [[40, 'TRANSACTION DATE'], [120, 'DESCRIPTION'], R(480, 'AMOUNT'), R(560, 'BALANCE')],
    [[40, '8/02/2026'], [120, 'Stripe Transfer ST-1234'], R(480, '$1,000.00'), R(560, '$1,100.00')], [[40, '8/04/2026'], [120, 'Stripe Transfer ST-1235'], R(480, '$500.00'), R(560, '$1,600.00')]]); b.doc = 1;
  const both = Core.parseStatement([a, b], {});
  assert.equal(both.bank.card_deposits.total, 9500);
});

test('review findings: check grids repeat the register only when month and day both match', () => {
  const r = Core.parseStatement([page([
    ...header,
    [[40, 'LAST STATEMENT 07/31/26'], R(570, '3,000.00')], [[40, '3 DEBITS'], R(570, '1,500.00')], [[40, 'THIS STATEMENT 08/31/26'], R(570, '1,500.00')], [[40, 'MINIMUM BALANCE'], R(300, '1,500.00')],
    [[180, '- - - - - - CHECKS - - - - - -']],
    [[40, 'CHECK # | DATE | AMOUNT | CHECK # | DATE | AMOUNT']],
    [[40, '1052'], [80, '08/05'], R(200, '500.00'), [240, '1053'], [280, '08/12'], R(400, '500.00')],
    [[180, '- - - - - - OTHER DEBITS - - - - - -']],
    [[40, 'DESCRIPTION'], [470, 'DATE'], R(570, 'AMOUNT')],
    [[40, 'ONLINE TRANSFER TO SAVINGS'], [470, '08/20'], R(570, '500.00')],
  ])], {});
  assert.equal(r.bank.debits_total, 1500);
});

test('second review: capital, payroll and gateway wording', () => {
  const c = (d, dir) => Core.classifyBankTx(d, dir);
  // the capital word must follow the processor's name; a holder name printed without a label is not a lender
  assert.equal(c('Bankcard-0000 Mtot Disc 260801 123456789 Capital Plumbing LLC', 'debit').category, 'processing_fee');
  assert.equal(c('ELAVON MERCH FEE 0000 CAP N CORK', 'debit').category, 'processing_fee');
  assert.equal(c('BA MERCHANT SVCS DES:FEES ID:0000 CAPITAL CITY DINER', 'debit').category, 'processing_fee');
  assert.deepEqual(c('SQUARE CAPITAL DES:LOAN PMT', 'debit'), { category: 'mca_payment', source: 'Square Capital' });
  // payroll through the processor is payroll
  assert.equal(c('SQUARE PAYROLL FEE', 'debit').category, 'other_debit');
  assert.equal(c('Square Inc Sq260801 Payroll Fee', 'debit').category, 'other_debit');
  assert.equal(c('Square Inc Sq260801 Payroll', 'credit').category, 'other_deposit');
  // payment gateways are POS software
  assert.equal(c('USAEPAY MONTHLY FEE', 'debit').category, 'software_fee');
  assert.equal(c('NMI GATEWAY FEE', 'debit').category, 'software_fee');
  assert.equal(c('AUTHORIZE.NET DES:BILLING ID:0000', 'debit').category, 'software_fee');
});

const summary = (begin, credits, end) => [[[40, 'Beginning Balance'], R(570, begin)], [[40, 'Deposits and Other Credits'], R(570, credits)], [[40, 'Ending Balance'], R(570, end)]];

test('second review: a lump refund of fees charged this month comes off the bank fees', () => {
  const r = Core.parseStatement([page([
    ...header, ...summary('$1,000.00', '70.00', '$965.00'),
    [[40, 'Deposits and Other Credits']], [[40, '08/20'], [90, 'NSF FEE REFUND'], R(570, '70.00')],
    [[40, 'Withdrawals and Other Debits']],
    [[40, '08/03'], [90, 'NSF FEE'], R(570, '35.00')], [[40, '08/09'], [90, 'NSF FEE'], R(570, '35.00')], [[40, '08/15'], [90, 'NSF FEE'], R(570, '35.00')],
  ])], {});
  assert.equal(r.bank.misc_fees.total, 35);
  assert.equal(r.bank.misc_fees.count, 3);
  // a refund that doesn't say which fee may be for an earlier month
  const bare = Core.parseStatement([page([
    ...header, ...summary('$1,000.00', '30.00', '$1,017.50'),
    [[40, 'Deposits and Other Credits']], [[40, '08/20'], [90, 'FEE REVERSAL'], R(570, '30.00')],
    [[40, 'Withdrawals and Other Debits']], [[40, '08/03'], [90, 'OVERDRAFT ITEM FEE'], R(570, '12.50')],
  ])], {});
  assert.equal(bare.bank.misc_fees.total, 12.5);
});

test('second review: warnings the review promises', () => {
  const warn = (rows, re) => Core.parseStatement([page([...header, ...rows])], {}).warnings.some(w => re.test(w));
  const netted = [...summary('$1,000.00', '5,000.00', '$6,000.00'), [[40, 'Deposits and Other Credits']], [[40, '08/03'], [90, 'SQUARE INC DES:SQ260803'], R(570, '5,000.00')]];
  assert.ok(warn(netted, /No separate processing-fee debits/));
  assert.ok(!warn(netted, /No card-processor deposits/));
  const none = [...summary('$1,000.00', '500.00', '$1,500.00'), [[40, 'Deposits and Other Credits']], [[40, '08/03'], [90, 'Branch Deposit'], R(570, '500.00')]];
  assert.ok(warn(none, /No card-processor deposits were found/));
  const returned = [...summary('$2,000.00', '600.00', '$2,000.00'),
    [[40, 'Deposits and Other Credits']], [[40, '08/05'], [90, 'ACH RETURN KAPITUS SERVICING DAILY PMT'], R(570, '600.00')],
    [[40, 'Withdrawals and Other Debits']], [[40, '08/04'], [90, 'KAPITUS SERVICING DAILY PMT'], R(570, '600.00')]];
  assert.ok(warn(returned, /was returned unpaid, so it isn’t counted — but the merchant still owes that lender/));
  // no printed deposit total: the balances catch a misread amount
  const off = [[[40, 'Beginning Balance'], R(570, '$1,000.00')], [[40, 'Ending Balance'], R(570, '$1,900.00')],
    [[40, 'Date'], [90, 'Description'], R(430, 'Debits'), R(500, 'Credits'), R(575, 'Balance')],
    [[40, '08/03'], [90, 'BANKCARD 0000 BTOT DEP'], R(500, '1,000.00')], [[40, '08/04'], [90, 'BANKCARD 0000 MTOT DISC'], R(430, '1,000.00')]];
  assert.ok(warn(off, /The transactions read are \$900\.00 off from the statement’s beginning and ending balances/));
});

test('second review: months across files that print no period', () => {
  const stmt = (doc, amt, period) => Object.assign(page([
    ...header.filter(h => !/Statement Period/.test(h[0][1])), ...(period ? [[[40, period]]] : []),
    ...summary('$1,000.00', amt, '$2,000.00'), [[40, 'Deposits and Other Credits']], [[40, '08/05'], [90, 'HEARTLAND PYMT SYS TXNS'], R(570, amt)],
  ]), { doc });
  const two = Core.parseStatement([stmt(0, '9,000.00'), stmt(1, '11,000.00')], {});
  assert.equal(two.bank.months, 2);
  assert.equal(two.volume, 10000);
  const mixed = Core.parseStatement([stmt(0, '9,000.00', 'Statement Period 07/01/2026 through 07/31/2026'), stmt(1, '11,000.00')], {});
  assert.equal(mixed.bank.months, 2);
  // the same period in two files (checking and savings) is one month
  const same = Core.parseStatement([stmt(0, '9,000.00', 'Statement Period 07/01/2026 through 07/31/2026'), stmt(1, '0.00', 'Statement Period 07/01/2026 through 07/31/2026')], {});
  assert.equal(same.bank.months, 1);
});

test('second review: a processing statement uploaded with the bank statement', () => {
  const proc = Object.assign(page([
    [[40, 'YOUR CARD PROCESSING STATEMENT']], [[40, 'SAMPLE BISTRO LLC']], [[40, '12 ELM ST']], [[40, 'SPRINGFIELD, TX 75001']],
    [[40, 'Statement Period 07/01/2026 - 07/31/2026']],
    [[40, 'Total Amount Submitted'], [400, '$12,000.00']], [[40, 'Total Fees Charged'], [400, '$360.00']], [[40, 'Total Transactions'], [400, '400']],
  ]), { doc: 0 });
  const bank = Object.assign(page([
    ...header, ...summary('$1,000.00', '11,640.00', '$12,140.00'),
    [[40, 'Deposits and Other Credits']], [[40, '08/03'], [90, 'BANKCARD 0000 BTOT DEP'], R(570, '11,640.00')],
    [[40, 'Withdrawals and Other Debits']], [[40, '08/05'], [90, 'TOAST INC DES:TOAST SUBSCR'], R(570, '165.00')], [[40, '08/06'], [90, 'KAPITUS SERVICING DAILY PMT'], R(570, '335.00')],
  ]), { doc: 1 });
  const r = Core.parseStatement([proc, bank], {});
  assert.equal(r.document_type, 'processing_statement');
  assert.equal(r.volume, 12000);
  assert.equal(r.total_fees, 360);
  assert.ok(r.bank && r.bank.companion);
  assert.equal(r.bank.months, 1);                          // the processing statement's period isn't a bank month
  assert.equal(r.bank.software_fees.total, 165);
  assert.equal(r.bank.mca_payments.total, 335);
  assert.ok(r.warnings.some(w => /A bank statement was uploaded too/.test(w)));
  // a bank statement alone is unchanged
  assert.equal(Core.parseStatement([bank], {}).document_type, 'bank_statement');
});

test('second review: PayPal subscriptions, more column labels, summary headers, left-margin headings', () => {
  const pp = Core.parseStatement([page([
    ...header, ...summary('$1,000.00', '0.00', '$760.00'), [[40, 'Withdrawals and Other Debits']],
    [[40, '08/01'], [90, 'Recurring Payment authorized on 07/31 PAYPAL *SAMPLESOFT'], R(570, '120.00')],
    [[40, '08/15'], [90, 'Recurring Payment authorized on 08/14 PAYPAL *SAMPLESOFT'], R(570, '120.00')],
  ])], {});
  assert.equal(pp.bank.mca_payments.total, 0);
  const rows = [[[40, '8/3'], [90, 'BANKCARD 0000 BTOT DEP'], R(500, '8,000.00')], [[40, '8/4'], [90, 'BANKCARD 0000 MTOT DISC'], R(430, '320.00')]];
  for (const h of [['Checks/Debits', 'Deposits/Credits'], ['Payments', 'Receipts'], ['Withdrawals/Subtractions', 'Deposits/Additions'], ['Checks and Withdrawals', 'Deposits and Credits']]) {
    const r = Core.parseStatement([page([...header, [[40, 'Beginning Balance'], R(570, '$1,000.00')], [[40, 'Total Deposits'], R(570, '$8,000.00')], [[40, 'Ending Balance'], R(570, '$8,680.00')],
      [[40, 'Date'], [90, 'Description'], R(430, h[0]), R(500, h[1]), R(575, 'Balance')], ...rows])], {});
    assert.equal(r.bank.card_deposits.total, 8000, h.join('/'));
    assert.equal(r.bank.processing_fees.total, 320, h.join('/'));
  }
  // "Balance Last Statement | Deposits/Credits | Checks/Debits | Balance This Statement" is a summary, not the register's columns
  const sum = Core.parseStatement([page([...header,
    [R(160, 'Balance Last Statement'), R(300, 'Deposits/Credits'), R(430, 'Checks/Debits'), R(570, 'Balance This Statement')],
    [R(160, '1,000.00'), R(300, '8,000.00'), R(430, '320.00'), R(570, '8,680.00')],
    [[40, 'DATE'], [90, 'DESCRIPTION'], R(480, 'AMOUNT'), R(560, 'BALANCE')],
    [[40, '08/03'], [90, 'BANKCARD 0000 DES:BTOT DEP'], R(480, '8,000.00'), R(560, '9,000.00')], [[40, '08/04'], [90, 'BANKCARD 0000 DES:MTOT DISC'], R(480, '-320.00'), R(560, '8,680.00')]])], {});
  assert.equal(sum.bank.card_deposits.total, 8000);
  assert.equal(sum.bank.processing_fees.total, 320);
  // DESCRIPTION | DATE | AMOUNT layout: a heading at the left margin starts a new section
  const mid = Core.parseStatement([page([...header,
    [[330, 'LAST STATEMENT 07/31/26'], R(570, '1,000.00')], [[330, '1 CREDITS'], R(570, '2,000.00')], [[330, '1 DEBITS'], R(570, '60.00')], [[330, 'THIS STATEMENT 08/31/26'], R(570, '2,940.00')],
    [[40, 'MINIMUM BALANCE'], R(300, '1,000.00')],
    [[40, 'CREDITS']], [[40, 'DESCRIPTION'], [470, 'DATE'], R(570, 'AMOUNT')],
    [[40, 'MERCH DEP BANKCARD 0000 BTOT DEP'], [470, '08/05'], R(570, '2,000.00')],
    [[40, 'DEBITS']], [[40, 'DESCRIPTION'], [470, 'DATE'], R(570, 'AMOUNT')],
    [[40, 'BANKCARD 0000 MTOT DISC'], [470, '08/06'], R(570, '60.00')],
  ])], {});
  assert.equal(mid.bank.card_deposits.total, 2000);
  assert.equal(mid.bank.processing_fees.total, 60);
  assert.equal(mid.bank.debits_total, 60);
});

test('third review: holder names, entry descriptions, refunds and gateways', () => {
  const c = (d, dir) => Core.classifyBankTx(d, dir).category;
  assert.equal(c('BANKCARD 0000 BTOT DEP 260801 123456789 PAYROLL PLUS LLC', 'credit'), 'card_deposit');   // a holder name, not payroll
  assert.equal(c('BANKCARD 0000 MTOT DISC 260801 123456789 GUSTO BISTRO', 'debit'), 'processing_fee');
  assert.equal(c('SQUARE INC DES:CAPITAL ID:0000', 'debit'), 'mca_payment');
  assert.equal(c('360 PAYMENTS DES:CAPITAL ID:0000', 'debit'), 'mca_payment');
  assert.equal(c('SAMPLE GATEWAY SERVICE LLC', 'debit'), 'other_debit');
  assert.equal(c('PAYMENT GATEWAY FEE', 'debit'), 'software_fee');
  const r = Core.parseStatement([page([
    ...header, ...summary('$1,000.00', '470.00', '$1,365.00'),
    [[40, 'Deposits and Other Credits']],
    [[40, '08/12'], [90, 'ACH RETURN NSF SAMPLE SUPPLY CO'], R(570, '400.00')],              // a vendor payment that bounced, not a fee refund
    [[40, '08/20'], [90, 'INSUFFICIENT FUNDS FEE REFUND'], R(570, '70.00')],
    [[40, 'Withdrawals and Other Debits']],
    [[40, '08/03'], [90, 'NSF FEE'], R(570, '35.00')], [[40, '08/09'], [90, 'NSF FEE'], R(570, '35.00')], [[40, '08/15'], [90, 'NSF FEE'], R(570, '35.00')],
  ])], {});
  assert.equal(r.bank.misc_fees.total, 35);
});

test('third review: extra files add no months, and the bank flags survive a mixed upload', () => {
  const bank = doc => Object.assign(page([
    ...header, ...summary('$1,000.00', '10,000.00', '$10,000.00'),
    [[40, 'Deposits and Other Credits']], [[40, '08/03'], [90, 'BANKCARD 0000 BTOT DEP'], R(570, '10,000.00')],
    [[40, 'Withdrawals and Other Debits']], ...Array.from({ length: 20 }, (_, d) => [[40, '08/' + String(d + 1).padStart(2, '0')], [90, 'ACH DEBIT QUICKSILVER CAP LLC'], R(570, '50.00')]),
  ]), { doc });
  const checks = Object.assign(page([[[40, 'CHECK IMAGES']], [[40, 'Check 1001 Amount $250.00 Date 08/05/2026']], [[40, 'Check 1002 Amount $120.00 Date 08/12/2026']]]), { doc: 1 });
  const r = Core.parseStatement([bank(0), checks], {});
  assert.equal(r.bank.months, 1);
  assert.equal(r.volume, 10000);
  // a disclosure insert that restarts its own "Page 1 of 2" is not another month
  const insert = page([[[400, 'Page 1 of 2'], [440, 'Important Information About Your Account']], [[40, 'SAMPLE BANK']]]);
  const withInsert = Core.parseStatement([Object.assign(page([[[400, 'Page 1 of 3']], ...header.filter(h => !/Statement Period/.test(h[0][1])), ...summary('$1,000.00', '10,000.00', '$11,000.00'),
    [[40, 'Deposits and Other Credits']], [[40, '08/03'], [90, 'BANKCARD 0000 BTOT DEP'], R(570, '10,000.00')]])), insert], {});
  assert.equal(withInsert.bank.months, 1);
  const proc = Object.assign(page([
    [[40, 'YOUR CARD PROCESSING STATEMENT']], [[40, 'SAMPLE BISTRO LLC']], [[40, '12 ELM ST']], [[40, 'SPRINGFIELD, TX 75001']],
    [[40, 'Total Amount Submitted'], [400, '$12,000.00']], [[40, 'Total Fees Charged'], [400, '$360.00']],
  ]), { doc: 2 });
  const mixed = Core.parseStatement([bank(0), proc], {});
  assert.equal(mixed.document_type, 'processing_statement');
  assert.ok(mixed.warnings.some(w => /^Bank statement: Repeating debit to Quicksilver Cap LLC/.test(w)), mixed.warnings.join(' | '));
});
