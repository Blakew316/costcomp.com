// Exercises netlify/functions/scan-statement.mts against a local mock of the Anthropic Messages API.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const EXTRACTED = {
  is_statement: true, merchant_name: 'Sample Cafe', legal_name: 'Sample Holdings LLC',
  address: { street: '100 Main St', city: 'Austin', state: 'TX', zip: '78701' },
  mid: '5544000000000000', processor: 'Example Processor', statement_period: '07/01/26 - 07/31/26',
  volume: 25000, refunds: 0, transactions: 500, transactions_derived: false, total_fees: 780.5,
  fee_breakdown: { interchange: 410.2, card_brand_fees: 40.1, processor_fees: 330.2 },
  card_mix: [{ brand: 'visa', type: 'credit', volume: 15000, count: 300 }, { brand: 'visa', type: 'debit', volume: 10000, count: 200 }],
  interchange_lines: [], notes: [], confidence: 'high',
};

let server, requests = [], reply = 'ok';
function sse(res, text, stopReason = 'end_turn') {
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
  ev('message_start', { message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1200, output_tokens: 1 } } });
  ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
  for (let i = 0; i < text.length; i += 40) ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: text.slice(i, i + 40) } });
  ev('content_block_stop', { index: 0 });
  ev('message_delta', { delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 300 } });
  ev('message_stop', {});
  res.end();
}

before(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      requests.push({ url: req.url, headers: req.headers, body: JSON.parse(body) });
      if (reply === 'ok') return sse(res, JSON.stringify(EXTRACTED));
      if (reply === 'refusal') return sse(res, '', 'refusal');
      if (reply === '429') { res.writeHead(429, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } })); }
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const env = { ANTHROPIC_API_KEY: 'test-key' };
globalThis.Netlify = { env: { get: k => env[k] } };
const { default: handler, config } = await import('../netlify/functions/scan-statement.mts');
const post = body => handler(new Request('http://localhost/api/scan-statement', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }), {});
const PDF_B64 = Buffer.from('%PDF-1.4 test').toString('base64');

test('serves on /api/scan-statement and reports configuration', async () => {
  assert.equal(config.path, '/api/scan-statement');
  const res = await handler(new Request('http://localhost/api/scan-statement'), {});
  assert.deepEqual(await res.json(), { configured: true });
});

test('sends the statement to Claude with structured output and returns a normalized result', async () => {
  reply = 'ok'; requests = [];
  const res = await post({ files: [{ name: 's.pdf', media_type: 'application/pdf', data: PDF_B64 }] });
  const out = await res.json();
  assert.equal(res.status, 200);
  assert.equal(out.ok, true);
  assert.equal(out.result.source, 'ai');
  assert.equal(out.result.merchant_name, 'Sample Cafe');
  assert.equal(out.result.address, '100 Main St, Austin, TX 78701');
  assert.equal(out.result.total_fees, 780.5);

  const sent = requests[0];
  assert.match(sent.url, /\/v1\/messages/);
  assert.equal(sent.body.model, 'claude-opus-5');
  assert.equal(sent.body.stream, true);
  assert.equal(sent.body.fallbacks, 'default');
  assert.match(sent.headers['anthropic-beta'], /server-side-fallback-2026-07-01/);
  assert.equal(sent.body.output_config.format.type, 'json_schema');
  assert.equal(sent.body.output_config.effort, 'low');
  assert.deepEqual(sent.body.thinking, { type: 'adaptive' });
  assert.equal(sent.body.messages[0].content[0].type, 'document');
  assert.equal(sent.body.messages[0].content[0].source.media_type, 'application/pdf');
});

test('sends photos as image blocks', async () => {
  reply = 'ok'; requests = [];
  await post({ files: [{ media_type: 'image/jpeg', data: PDF_B64 }, { media_type: 'image/jpeg', data: PDF_B64 }] });
  const content = requests[0].body.messages[0].content;
  assert.deepEqual(content.map(c => c.type), ['image', 'image', 'text']);
  assert.match(content[2].text, /2 files are pages of one/);
});

test('rejects bad input without calling the API', async () => {
  requests = [];
  assert.equal((await post({ files: [] })).status, 400);
  assert.equal((await post({ files: [{ media_type: 'text/html', data: PDF_B64 }] })).status, 415);
  assert.equal((await post({ files: [{ media_type: 'application/pdf', data: 'not base64!' }] })).status, 400);
  assert.equal(requests.length, 0);
});

test('maps refusals and rate limits to clear errors', async () => {
  reply = 'refusal';
  let res = await post({ files: [{ media_type: 'application/pdf', data: PDF_B64 }] });
  assert.equal(res.status, 422);
  reply = '429';
  res = await post({ files: [{ media_type: 'application/pdf', data: PDF_B64 }] });
  assert.equal(res.status, 429);
  assert.equal((await res.json()).code, 'rate_limited');
});

test('returns 501 when no API key is configured so the page uses the on-device reader', async () => {
  delete env.ANTHROPIC_API_KEY;
  const res = await post({ files: [{ media_type: 'application/pdf', data: PDF_B64 }] });
  assert.equal(res.status, 501);
  assert.equal((await res.json()).code, 'not_configured');
  env.ANTHROPIC_API_KEY = 'test-key';
});
