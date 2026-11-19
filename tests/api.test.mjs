// اختبارات الخادم: تعمل على خادم حقيقي وقاعدة بيانات PostgreSQL حقيقية
// التشغيل: BASE=http://localhost:3100 DATABASE_URL=... ADMIN_PASSWORD=... node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const BASE = process.env.BASE || 'http://localhost:3100';
const ADMIN_PW = process.env.ADMIN_PASSWORD;
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });

class Client {
  constructor(ip) { this.cookies = {}; this.ip = ip || `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`; }
  async req(path, body, method) {
    const headers = { 'x-forwarded-for': this.ip };
    const ck = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
    if (ck) headers.cookie = ck;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const r = await fetch(BASE + path, { method: method || (body !== undefined ? 'POST' : 'GET'), headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    for (const c of r.headers.getSetCookie?.() || []) {
      const [kv] = c.split(';'); const i = kv.indexOf('=');
      const k = kv.slice(0, i), v = kv.slice(i + 1);
      if (v === '' || /max-age=0/i.test(c)) delete this.cookies[k]; else this.cookies[k] = v;
    }
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: r.status, data, text, headers: r.headers };
  }
}
const uniq = (p) => `${p} ${Math.random().toString(36).slice(2, 7).replace(/[0-9]/g, 'ك')}`.replace(/[a-z]/g, (c) => 'ابتثجحخدذرزسشصضطظعغفقلمنهوي'[c.charCodeAt(0) - 97] || 'ي');
const admin = new Client('9.9.9.9');
async function setSettings(s) { const r = await admin.req('/api/admin/settings', s); assert.equal(r.status, 200); }
async function play(c, answers) { for (const [q, a] of answers) { const r = await c.req('/api/answer', { questionId: q, choice: a }); assert.equal(r.status, 200, JSON.stringify(r.data)); } }
const ALL_RIGHT = [['q1', 'a'], ['q2', 'c'], ['q3', 'b']];

test('تهيئة: دخول الإدارة وبدء جولة نظيفة', async () => {
  const bad = await admin.req('/api/admin/login', { password: 'wrong' });
  assert.equal(bad.status, 401);
  const unauth = await new Client().req('/api/admin/overview');
  assert.equal(unauth.status, 401, 'لوحة الإدارة محمية');
  const ok = await admin.req('/api/admin/login', { password: ADMIN_PW });
  assert.equal(ok.status, 200);
  const noConfirm = await admin.req('/api/admin/reset', { reason: 'بداية الاختبار' });
  assert.equal(noConfirm.status, 400);
  const r = await admin.req('/api/admin/reset', { reason: 'بداية الاختبار', confirm: 'حذف الكل' });
  assert.equal(r.status, 200);
  await setSettings({ registration_open: true, play_open: true, results_announced: false });
});

test('الصحة والحالة الابتدائية', async () => {
  const h = await new Client().req('/api/health');
  assert.equal(h.status, 200); assert.equal(h.data.ok, true);
  const s = await new Client().req('/api/state');
  assert.equal(s.data.me, null); assert.equal(s.data.question, null);
});

test('التحقق من الاسم', async () => {
  const c = new Client();
  for (const name of ['', 'ا', 'x'.repeat(31), 'سارة<script>', '12345']) {
    const r = await c.req('/api/register', { name });
    assert.equal(r.status, 400, `يجب رفض: ${name}`);
    assert.ok(r.data.error);
  }
});

test('منع تكرار الاسم حتى بصيغة إملائية مختلفة', async () => {
  const a = await new Client().req('/api/register', { name: 'سارة أحمد' });
  assert.equal(a.status, 200);
  for (const v of ['ساره احمد', 'سارَة   أحمد', 'سـارة إحمد', 'سارة آحمد']) {
    const r = await new Client().req('/api/register', { name: v });
    assert.equal(r.status, 409, `يجب رفض: ${v}`);
  }
  const ok = await new Client().req('/api/register', { name: 'سارة محمد' });
  assert.equal(ok.status, 200);
});

test('رحلة كاملة: خطأ ثم صحيح، منع التخطي، التقدم 0→50→100', async () => {
  const c = new Client();
  const reg = await c.req('/api/register', { name: uniq('ليان') });
  assert.equal(reg.status, 200);
  assert.match(reg.data.me.recoveryCode, /^[A-Z2-9]{3}-[A-Z2-9]{3}$/);
  assert.ok(c.cookies.cer_player, 'تم ضبط ملف تعريف الجلسة');
  assert.equal(reg.data.me.progress, 0);

  const early = await c.req('/api/answer', { questionId: 'q1', choice: 'a' });
  assert.equal(early.status, 409, 'لا إجابة قبل بدء المهمة');

  const st = await c.req('/api/start', {});
  assert.equal(st.status, 200); assert.equal(st.data.me.started, true);
  assert.equal(st.data.question.id, 'q1');
  assert.ok(!('correct' in st.data.question), 'الإجابة الصحيحة لا تصل للمتصفح');
  assert.ok(!/"correct"\s*:\s*"[a-d]"/.test(st.text));
  assert.equal(st.data.question.options.length, 4);

  const skip = await c.req('/api/answer', { questionId: 'q3', choice: 'b' });
  assert.equal(skip.data.stale, true, 'لا يمكن تخطي الأسئلة');
  assert.equal(skip.data.me.step, 0);

  const invalid = await c.req('/api/answer', { questionId: 'q1', choice: 'z' });
  assert.equal(invalid.status, 400);

  const wrong = await c.req('/api/answer', { questionId: 'q1', choice: 'b' });
  assert.equal(wrong.data.correct, false);
  assert.equal(wrong.data.me.correct, 0, 'الخطأ لا يمنح نقاطًا');
  assert.equal(wrong.data.question.id, 'q1', 'يبقى على السؤال نفسه لإعادة المحاولة');
  assert.equal(wrong.data.message, 'ليست هذه الإجابة الصحيحة، حاولي مرة أخرى أيتها المبرمجة!');
  assert.ok(!wrong.text.includes('تنفيذ الأوامر لعدد محدد') || wrong.data.question.options, 'لا يكشف الإجابة');

  const r1 = await c.req('/api/answer', { questionId: 'q1', choice: 'a' });
  assert.equal(r1.data.correct, true);
  assert.equal(r1.data.message, 'ممتاز! لقد نجحتِ في حل أول تحدٍ برمجي');
  assert.equal(r1.data.me.correct, 1); assert.equal(r1.data.me.progress, 0); assert.equal(r1.data.question.id, 'q2');

  const again = await c.req('/api/answer', { questionId: 'q1', choice: 'a' });
  assert.equal(again.data.stale, true, 'لا يُحتسب السؤال مرتين'); assert.equal(again.data.me.correct, 1);

  const r2w = await c.req('/api/answer', { questionId: 'q2', choice: 'a' });
  assert.equal(r2w.data.correct, false);
  const r2 = await c.req('/api/answer', { questionId: 'q2', choice: 'c' });
  assert.equal(r2.data.message, 'أحسنتن! تم اجتياز الغرفة الأولى بنجاح');
  assert.equal(r2.data.me.progress, 50); assert.equal(r2.data.me.roomsDone, 1); assert.equal(r2.data.question.room, 2);

  const r3w = await c.req('/api/answer', { questionId: 'q3', choice: 'd' });
  assert.equal(r3w.data.message, 'اقتربتِ من الحل! فكري في اللبنة التي تسمح بتكرار الأوامر عدة مرات، ثم حاولي مجددًا.');
  const r3 = await c.req('/api/answer', { questionId: 'q3', choice: 'b' });
  assert.equal(r3.data.message, 'مذهل! لقد نجحتِ في حل التحدي النهائي!');
  assert.equal(r3.data.me.finished, true); assert.equal(r3.data.me.progress, 100);
  assert.equal(r3.data.me.correct, 3); assert.equal(r3.data.me.roomsDone, 2); assert.equal(r3.data.question, null);

  const after = await c.req('/api/answer', { questionId: 'q3', choice: 'b' });
  assert.equal(after.data.stale, true, 'لا إعادة محاولة بعد الإكمال');
  assert.equal(after.data.me.correct, 3);

  const row = (await db.query('SELECT wrong_attempts, correct_count FROM participants WHERE recovery_code=$1', [reg.data.me.recoveryCode])).rows[0];
  assert.equal(row.wrong_attempts, 3); assert.equal(row.correct_count, 3);
});

test('الإرسال المتزامن لنفس السؤال يُحتسب مرة واحدة', async () => {
  const c = new Client();
  await c.req('/api/register', { name: uniq('جود') });
  await c.req('/api/start', {});
  const rs = await Promise.all(Array.from({ length: 12 }, () => c.req('/api/answer', { questionId: 'q1', choice: 'a' })));
  assert.equal(rs.filter((r) => r.data.correct === true).length, 1);
  const s = await c.req('/api/state');
  assert.equal(s.data.me.correct, 1); assert.equal(s.data.me.step, 1);
});

test('وضع التدريب: بعد الإكمال فقط ولا يغير النتيجة', async () => {
  const c = new Client();
  await c.req('/api/register', { name: uniq('ريم') });
  assert.equal((await c.req('/api/practice')).status, 403);
  await c.req('/api/start', {}); await play(c, ALL_RIGHT);
  const g = await c.req('/api/practice');
  assert.equal(g.status, 200); assert.equal(g.data.questions.length, 3);
  assert.ok(!/"correct"/.test(g.text));
  const p = await c.req('/api/practice', { questionId: 'q1', choice: 'b' });
  assert.equal(p.data.correct, false);
  const s = await c.req('/api/state');
  assert.equal(s.data.me.correct, 3);
});

test('الاستعادة برمز من جهاز آخر', async () => {
  const a = new Client();
  const reg = await a.req('/api/register', { name: uniq('هند') });
  await a.req('/api/start', {}); await play(a, [['q1', 'a']]);
  const b = new Client();
  const bad = await b.req('/api/restore', { code: 'ZZZ-ZZZ' });
  assert.equal(bad.status, 404);
  const r = await b.req('/api/restore', { code: reg.data.me.recoveryCode.toLowerCase().replace('-', ' ') });
  assert.equal(r.status, 200);
  assert.equal(r.data.me.step, 1); assert.equal(r.data.question.id, 'q2');
  await play(b, [['q2', 'c']]);
  const s = await b.req('/api/state'); assert.equal(s.data.me.progress, 50);
});

test('الزمن العادل: لا يُحتسب وقت إغلاق الصفحة', async () => {
  const c = new Client();
  const reg = await c.req('/api/register', { name: uniq('نوف') });
  await c.req('/api/start', {});
  const code = reg.data.me.recoveryCode;
  await db.query("UPDATE participants SET active_ms=0, last_beat = now() - interval '4 seconds' WHERE recovery_code=$1", [code]);
  await c.req('/api/heartbeat', { visible: true });
  let ms = Number((await db.query('SELECT active_ms FROM participants WHERE recovery_code=$1', [code])).rows[0].active_ms);
  assert.ok(ms >= 3900 && ms < 5500, `يُحتسب ~4 ث: ${ms}`);
  await c.req('/api/heartbeat', { visible: false });
  await db.query("UPDATE participants SET last_beat = NULL WHERE recovery_code=$1", [code]);
  await c.req('/api/heartbeat', { visible: true });
  const ms2 = Number((await db.query('SELECT active_ms FROM participants WHERE recovery_code=$1', [code])).rows[0].active_ms);
  assert.ok(ms2 - ms < 300, 'وقت الإخفاء لا يُحتسب');
  await db.query("UPDATE participants SET last_beat = now() - interval '10 minutes' WHERE recovery_code=$1", [code]);
  await c.req('/api/heartbeat', { visible: true });
  const ms3 = Number((await db.query('SELECT active_ms FROM participants WHERE recovery_code=$1', [code])).rows[0].active_ms);
  assert.ok(ms3 - ms2 < 300, 'فجوة إغلاق الصفحة لا تُحتسب');
});

test('إغلاق التسجيل واللعب من لوحة الإدارة', async () => {
  const c = new Client();
  await c.req('/api/register', { name: uniq('دانة') });
  await setSettings({ registration_open: false });
  const r = await new Client().req('/api/register', { name: uniq('مها') });
  assert.equal(r.status, 423);
  await setSettings({ registration_open: true, play_open: false });
  assert.equal((await c.req('/api/start', {})).status, 423);
  await setSettings({ play_open: true });
  await c.req('/api/start', {});
  await setSettings({ play_open: false });
  assert.equal((await c.req('/api/answer', { questionId: 'q1', choice: 'a' })).status, 423);
  const hb = await c.req('/api/heartbeat', { visible: true });
  assert.equal(hb.data.playOpen, false);
  await setSettings({ play_open: true });
  assert.equal((await c.req('/api/answer', { questionId: 'q1', choice: 'a' })).data.correct, true);
});

test('15 مشاركة تلعب في الوقت نفسه + 40 تسجيلًا متزامنًا', async () => {
  const names = Array.from({ length: 40 }, (_, i) => uniq('طالبة') + ' ' + 'ابتثجحخدذرزسشصضطظعغفقلمنهوي'[i % 28] + 'ي'.repeat(1 + Math.floor(i / 28)));
  const clients = names.map(() => new Client());
  const regs = await Promise.all(clients.map((c, i) => c.req('/api/register', { name: names[i] })));
  assert.equal(regs.filter((r) => r.status === 200).length, 40, JSON.stringify(regs.filter((r) => r.status !== 200).map((r) => r.data)));
  const players = clients.slice(0, 15);
  await Promise.all(players.map((c) => c.req('/api/start', {})));
  await Promise.all(players.map(async (c, i) => {
    if (i % 3 === 0) await c.req('/api/answer', { questionId: 'q1', choice: 'd' });
    await play(c, ALL_RIGHT);
  }));
  const states = await Promise.all(players.map((c) => c.req('/api/state')));
  assert.ok(states.every((s) => s.data.me.finished && s.data.me.correct === 3));
});

test('لوحة المتصدرين: أعداد فقط قبل الإعلان، ترتيب كامل بعده مع كسر التعادل', async () => {
  const pre = await new Client().req('/api/leaderboard');
  assert.equal(pre.data.announced, false); assert.deepEqual(pre.data.rows, []);
  assert.ok(pre.data.counts.registered > 0);
  assert.ok(!pre.text.includes('سارة'), 'لا أسماء قبل الإعلان');

  const fast = new Client(), slow = new Client(), partial = new Client();
  const fr = await fast.req('/api/register', { name: 'أسرع مبرمجة' });
  const sr = await slow.req('/api/register', { name: 'مبرمجة متأنية' });
  await partial.req('/api/register', { name: 'مبرمجة لم تكمل' });
  for (const c of [fast, slow, partial]) await c.req('/api/start', {});
  await play(fast, ALL_RIGHT); await play(slow, ALL_RIGHT); await play(partial, [['q1', 'a']]);
  await db.query('UPDATE participants SET active_ms = 1000 WHERE recovery_code=$1', [fr.data.me.recoveryCode]);
  await db.query('UPDATE participants SET active_ms = 2000 WHERE recovery_code=$1', [sr.data.me.recoveryCode]);
  await db.query('UPDATE participants SET active_ms = 999999 WHERE finished_at IS NOT NULL AND recovery_code NOT IN ($1,$2)', [fr.data.me.recoveryCode, sr.data.me.recoveryCode]);

  await setSettings({ results_announced: true });
  const post = await new Client().req('/api/leaderboard');
  assert.equal(post.data.announced, true);
  assert.equal(post.data.rows[0].name, 'أسرع مبرمجة');
  assert.equal(post.data.rows[1].name, 'مبرمجة متأنية');
  const p = post.data.rows.find((r) => r.name === 'مبرمجة لم تكمل');
  assert.equal(p.finished, false); assert.equal(p.score, 1);
  const firstUnfinished = post.data.rows.findIndex((r) => !r.finished);
  assert.ok(post.data.rows.slice(firstUnfinished).every((r) => !r.finished), 'المكتملات أولًا');
  const st = await fast.req('/api/state');
  assert.equal(st.data.settings.resultsAnnounced, true);
  await setSettings({ results_announced: false });
});

test('الإدارة: تصحيح وحذف بسبب إلزامي، سجل العمليات، تصدير CSV', async () => {
  const ov = await admin.req('/api/admin/overview');
  assert.equal(ov.status, 200);
  const target = ov.data.participants.find((p) => p.name === 'مبرمجة لم تكمل');
  assert.ok(target.perQuestion[0].solvedAt); assert.equal(target.perQuestion[1].attempts, 0);

  assert.equal((await admin.req('/api/admin/participant', { action: 'adjust', id: target.id, score: 3 })).status, 400, 'السبب إلزامي');
  assert.equal((await admin.req('/api/admin/participant', { action: 'adjust', id: target.id, score: 5, reason: 'تصحيح' })).status, 400);
  const adj = await admin.req('/api/admin/participant', { action: 'adjust', id: target.id, score: 2, reason: 'خلل في الجهاز' });
  assert.equal(adj.status, 200);
  const ov2 = await admin.req('/api/admin/overview');
  assert.equal(ov2.data.participants.find((p) => p.id === target.id).score, 2);
  assert.ok(ov2.data.log.some((l) => l.action === 'adjust' && l.reason === 'خلل في الجهاز'));

  const evil = new Client();
  await evil.req('/api/register', { name: 'سلمى' });
  const ov3 = await admin.req('/api/admin/overview');
  const ev = ov3.data.participants.find((p) => p.name === 'سلمى');
  const csv = await admin.req('/api/admin/export');
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  const raw = new Uint8Array(await (await fetch(BASE + '/api/admin/export', { headers: { cookie: `cer_admin=${admin.cookies.cer_admin}` } })).arrayBuffer());
  assert.deepEqual([...raw.slice(0, 3)], [0xef, 0xbb, 0xbf], 'BOM ليفتح بالعربية في Excel');
  assert.ok(csv.text.includes('الترتيب') && csv.text.includes('مبرمجة لم تكمل'));
  assert.equal((await new Client().req('/api/admin/export')).status, 401);

  const del = await admin.req('/api/admin/participant', { action: 'delete', id: ev.id, reason: 'تسجيل تجريبي' });
  assert.equal(del.status, 200);
  assert.equal((await evil.req('/api/state')).data.me, null, 'الجلسة لم تعد صالحة بعد الحذف');
  const ov4 = await admin.req('/api/admin/overview');
  assert.ok(ov4.data.log.some((l) => l.action === 'delete' && l.participant_name === 'سلمى'));
});

test('ملف الجلسة المزور لا يعمل', async () => {
  const c = new Client(); c.cookies.cer_player = 'a'.repeat(64);
  assert.equal((await c.req('/api/state')).data.me, null);
  assert.equal((await c.req('/api/answer', { questionId: 'q1', choice: 'a' })).status, 401);
  const a = new Client(); a.cookies.cer_admin = `admin.${Date.now() + 1e7}.deadbeef`;
  assert.equal((await a.req('/api/admin/overview')).status, 401);
});

test('تنظيف', async () => {
  await admin.req('/api/admin/reset', { reason: 'نهاية الاختبار', confirm: 'حذف الكل' });
  await db.end();
});
