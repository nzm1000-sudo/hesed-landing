// חסד יסובבנו — donation page. Card fields live inside Nedarim Plus's iframe; everything else is ours.
const NEDARIM = 'https://www.matara.pro';
// ApiValid only authorises the embed and is public by design (it cannot read data); the secret API key never comes here.
const LIVE = { mosad: '5776132', apiValid: 'P+PGiNGTTe' };
const TEST = { mosad: '0', apiValid: 'j+iyEFN3bE' };

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
const isTest = params.has('test');
const cfg = isTest ? TEST : LIVE;
const useIframe = Boolean(cfg.apiValid);
const fmt = (n) => new Intl.NumberFormat('he-IL').format(n);
const digits = (v) => String(v || '').replace(/\D/g, '');

const form = $('#give');
const el = {
  freqGroup: $('[data-freq-group]'),
  chips: $('[data-chips]'),
  custom: $('[data-custom-amount]'),
  amount: $('#g-amount'),
  fixed: $('[data-fixed-amount]'),
  fixedLabel: $('[data-fixed-label]'),
  fixedSum: $('[data-fixed-sum]'),
  namesField: $('[data-names-field]'),
  names: $('#g-names'),
  payments: $('[data-payments-field]'),
  months: $('[data-months-field]'),
  zeoutOpt: $('[data-zeout-opt]'),
  dedication: $('[data-dedication-field]'),
  slip: $('[data-card-slip]'),
  slipLoading: $('[data-slip-loading]'),
  frame: $('#NedarimFrame'),
  cardErr: $('[data-err-for="card"]'),
  summary: $('[data-summary]'),
  submit: $('[data-submit]'),
  submitLabel: $('[data-submit-label]'),
  alert: $('[data-form-alert]'),
  altPay: $('[data-alt-pay]'),
  thanks: $('[data-thanks]'),
};

if (isTest) $('[data-test-banner]').hidden = false;

/* ---------- purposes added in Nedarim after this page was written appear on their own ---------- */
async function loadExtraCategories() {
  let list;
  try {
    const res = await fetch(`${NEDARIM}/nedarimplus/online/Files/Manage.aspx?Action=GetMosad&MosadId=${LIVE.mosad}`);
    list = JSON.parse((await res.json()).NewGroupe || '[]');
  } catch (e) { return; }
  const known = new Set($$('input[name="cat"]', form).map((i) => i.dataset.groupe));
  const grid = $('[data-extra-grid]');
  for (const g of list) {
    const name = String(g.Name || '').trim();
    if (!name || known.has(name) || g.GoToTofes || g.GoToMosad) continue;
    const amount = Number(g.Amount) || 0;
    const kind = !amount ? 'free' : /בחודש|לחודש/.test(name) ? 'monthly' : 'once';
    const label = document.createElement('label');
    label.className = 'cat';
    const input = Object.assign(document.createElement('input'), { type: 'radio', name: 'cat', value: 'g' + g.id });
    Object.assign(input.dataset, { groupe: name, kind, amount: String(amount) });
    const body = document.createElement('span');
    body.className = 'cat-body';
    const title = document.createElement('span');
    title.className = 'cat-name';
    title.textContent = name;
    const note = document.createElement('span');
    note.className = amount ? 'cat-price' : 'cat-note';
    note.textContent = amount ? `${fmt(amount)} ₪${kind === 'monthly' ? ' לחודש' : ''}` : 'סכום לבחירתכם';
    body.append(title, note);
    label.append(input, body);
    grid.append(label);
  }
  if (grid.children.length) $('[data-extra-cats]').hidden = false;
}
loadExtraCategories();

/* ---------- state ---------- */
function current() {
  const cat = $('input[name="cat"]:checked', form);
  const kind = cat.dataset.kind;
  const freq = kind === 'monthly' ? 'monthly' : kind === 'free' ? form.elements.freq.value : 'once';
  let amount = 0;
  let names = [];
  if (kind === 'free') {
    const typed = Number(el.amount.value.replace(/[^\d]/g, ''));
    const chip = $('input[name="chip"]:checked', form);
    amount = typed || (chip ? Number(chip.value) : 0);
  } else if (kind === 'perName') {
    names = el.names.value.split('\n').map((s) => s.trim()).filter(Boolean);
    amount = Number(cat.dataset.amount) * Math.max(1, names.length);
  } else {
    amount = Number(cat.dataset.amount);
  }
  return {
    kind, freq, amount, names,
    groupe: cat.dataset.groupe,
    title: $('.cat-name', cat.parentElement).textContent,
    payments: freq === 'once' ? Number(form.elements.payments.value) : 1,
    months: freq === 'monthly' ? form.elements.months.value : '',
  };
}

function summaryText(s) {
  if (s.freq === 'monthly') return `${fmt(s.amount)} ₪ לחודש · ${s.months ? s.months + ' חודשים' : 'ללא הגבלה'}`;
  return `${fmt(s.amount)} ₪` + (s.payments > 1 ? ` ב־${s.payments} תשלומים` : '');
}

function render() {
  const s = current();
  const free = s.kind === 'free';
  el.freqGroup.setAttribute('aria-disabled', String(!free));
  $$('input', el.freqGroup).forEach((i) => { i.disabled = !free; if (!free) i.checked = i.value === s.freq; });
  el.chips.hidden = !free;
  el.custom.hidden = !free;
  el.fixed.hidden = free;
  if (!free) {
    el.fixedLabel.textContent = s.kind === 'perName'
      ? `${s.title} · ${Math.max(1, s.names.length)} ${s.names.length === 1 || !s.names.length ? 'שם' : 'שמות'}`
      : s.title;
    el.fixedSum.textContent = `${fmt(s.amount)} ₪${s.freq === 'monthly' ? ' לחודש' : ''}`;
  }
  el.namesField.hidden = s.kind !== 'perName';
  el.dedication.hidden = s.kind === 'perName';
  el.payments.hidden = s.freq !== 'once';
  el.months.hidden = s.freq !== 'monthly';
  el.zeoutOpt.textContent = s.freq === 'monthly' ? 'נדרשת להוראת קבע' : 'לקבלה לפי סעיף 46';
  el.summary.textContent = s.amount ? summaryText(s) : '—';
  el.submitLabel.textContent = !useIframe
    ? 'להמשך לתשלום מאובטח'
    : s.freq === 'monthly' ? 'הצטרפות בהוראת קבע' : (s.amount ? `תרומה של ${fmt(s.amount)} ₪` : 'לתרומה');
  el.altPay.hidden = s.freq !== 'once';
}

form.addEventListener('change', (e) => {
  if (e.target.name === 'chip') { el.amount.value = ''; setErr('amount', ''); }
  if (e.target.name === 'cat' && e.target.dataset.kind === 'free') $('input[name="freq"][value="once"]', form).checked = true;
  render();
});
el.amount.addEventListener('input', () => {
  if (el.amount.value.trim()) $$('input[name="chip"]', form).forEach((c) => { c.checked = false; });
  setErr('amount', '');
  render();
});
el.names.addEventListener('input', () => { setErr('names', ''); render(); });
$$('input, textarea', form).forEach((f) => f.addEventListener('input', () => { if (f.name) setErr(f.name, ''); }));

/* ---------- validation ---------- */
function setErr(name, msg) {
  const box = $(`[data-err-for="${name}"]`, form);
  if (box) box.textContent = msg;
  const f = form.elements[name];
  if (f && f.setAttribute) { if (msg) f.setAttribute('aria-invalid', 'true'); else f.removeAttribute('aria-invalid'); }
}

function comment(s) {
  if (s.kind === 'perName') return 'תיקון נפטרים: ' + s.names.join(', ');
  return form.elements.comment.value.trim();
}

function validate(s, { donor = true } = {}) {
  const bad = [];
  const fail = (name, msg) => { setErr(name, msg); bad.push(form.elements[name]); };
  if (s.kind === 'free' && (!s.amount || s.amount < 5)) fail('amount', 'נא לבחור או להזין סכום (לפחות 5 ₪)');
  else if (s.kind === 'free' && s.amount > 1000000) fail('amount', 'הסכום גבוה מדי — לתרומה גדולה נשמח שתפנו אלינו');
  if (s.freq === 'once' && s.payments > 1 && s.amount / s.payments < 5) fail('amount', 'כל תשלום צריך להיות לפחות 5 ₪');
  if (s.kind === 'perName' && !s.names.length) fail('names', 'נא לרשום לפחות שם אחד');
  if (s.kind === 'perName' && comment(s).length > 300) fail('names', 'רשימת השמות ארוכה מדי לתרומה אחת — חלקו לשתי תרומות או שלחו לנו בוואטסאפ');
  if (donor) {
    const f = form.elements;
    if (!f.first.value.trim()) fail('first', 'נא למלא שם פרטי');
    if (!f.last.value.trim()) fail('last', 'נא למלא שם משפחה');
    const ph = digits(f.phone.value);
    if (ph.length < 9 || ph.length > 15) fail('phone', 'נא למלא מספר טלפון תקין');
    const mail = f.mail.value.trim();
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) fail('mail', 'כתובת הדוא״ל אינה תקינה');
    const z = f.zeout.value.trim();
    if (s.freq === 'monthly' && !z) fail('zeout', 'להוראת קבע נדרש מספר תעודת זהות');
    else if (z && (!/^\d{5,9}$/.test(z))) fail('zeout', 'מספר זהות — ספרות בלבד, עד 9');
  }
  return bad[0] || null;
}

function donor() {
  const f = form.elements;
  let phone = digits(f.phone.value);
  if (phone.startsWith('972')) phone = '0' + phone.slice(3);
  return {
    first: f.first.value.trim(), last: f.last.value.trim(), phone,
    mail: f.mail.value.trim(), zeout: f.zeout.value.trim(),
  };
}

/* ---------- Nedarim payment page (fallback, Bit, bank transfer) ---------- */
function pageUrl(s, method) {
  const q = new URLSearchParams({ mosad: LIVE.mosad, Amount: String(s.amount), AmountLock: '1', Groupe: s.groupe, GroupeLock: '1' });
  if (method === 'bit') q.set('OnlyBit', '1');
  else if (method === 'transfer') q.set('OnlyDigitalTransfer', '1');
  else if (s.freq === 'monthly') { q.set('OnlyKeva', '1'); if (s.months) { q.set('Payment', s.months); q.set('PaymentLock', '1'); } }
  else { q.set('OnlyNormal', '1'); q.set('Payment', String(s.payments)); }
  const d = donor();
  if (d.first || d.last) q.set('ClientName', `${d.first} ${d.last}`.trim());
  if (d.phone) q.set('Phone', d.phone);
  if (d.mail) q.set('Email', d.mail);
  if (d.zeout) q.set('Zeout', d.zeout);
  const c = comment(s);
  if (c) q.set('Avour', c);
  q.set('Redirect', location.origin + location.pathname + '?thanks=1');
  return `${NEDARIM}/nedarimplus/online/?${q}`;
}

$$('[data-alt]', el.altPay).forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault();
  const s = current();
  const bad = validate(s, { donor: false });
  if (bad) { bad.focus(); return; }
  location.href = pageUrl(s, a.dataset.alt);
}));

/* ---------- iframe ---------- */
let frameReady = false;
let pending = null;
const post = (data) => el.frame.contentWindow.postMessage(data, NEDARIM);

if (useIframe) {
  // registered once for the page's lifetime: a second listener would handle (and could resend) every result twice
  window.addEventListener('message', (e) => {
    if (e.origin !== NEDARIM || e.source !== el.frame.contentWindow) return;
    const d = e.data || {};
    if (d.Name === 'Height') el.frame.style.height = (parseInt(d.Value, 10) + 8) + 'px';
    else if (d.Name === 'ValidateFields') onValidate(d);
    else if (d.Name === 'TransactionResponse') onResult(d.Value || {});
  });
  el.frame.addEventListener('load', () => {
    frameReady = true;
    el.slipLoading.hidden = true;
    post({ Name: 'GetHeight' });
  });
  el.frame.src = `${NEDARIM}/nedarimplus/iframe/?Picture=Hide`;
  let t = 0;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => frameReady && post({ Name: 'GetHeight' }), 200); });
} else {
  el.frame.remove();
  el.slip.classList.add('card-slip--fallback');
  el.slipLoading.hidden = false;
  el.slipLoading.textContent = 'בלחיצה על הכפתור תועברו לעמוד התשלום המאובטח של נדרים פלוס, עם כל הפרטים שמילאתם.';
}

function setBusy(on, label) {
  el.submit.setAttribute('aria-busy', String(on));
  el.submit.disabled = on;
  if (on) el.submitLabel.textContent = label; else render();
}

function showAlert(msg) { el.alert.textContent = msg; }

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (pending) return;
  showAlert('');
  el.cardErr.textContent = '';
  const s = current();
  const bad = validate(s);
  if (bad) { bad.focus(); return; }
  if (!useIframe) { location.href = pageUrl(s); return; }
  if (!frameReady) { showAlert('טופס התשלום עדיין נטען, נסו שוב בעוד רגע.'); return; }
  pending = s;
  setBusy(true, 'בודקים את פרטי הכרטיס…');
  post({ Name: 'ValidateFields' });
});

const CARD_FIELD = { Card: 'מספר הכרטיס', Expiration: 'תוקף הכרטיס', CVV: '3 הספרות שבגב הכרטיס' };
function onValidate(d) {
  if (!pending) return;
  if (d.Value === 'OK') {
    setBusy(true, 'מבצעים את התרומה…');
    post({ Name: 'FinishTransaction2', Value: payload(pending) });
    return;
  }
  const name = CARD_FIELD[d.Field] || 'פרטי הכרטיס';
  el.cardErr.textContent = d.ErrorType === 'Empty' ? `נא למלא את ${name}` : `${name} — הערך אינו תקין`;
  pending = null;
  setBusy(false);
  el.slip.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.frame.focus();
}

function payload(s) {
  const d = donor();
  // Nedarim requires every key to be present, even when empty
  return {
    Mosad: cfg.mosad, ApiValid: cfg.apiValid,
    PaymentType: s.freq === 'monthly' ? 'HK' : 'Ragil',
    Currency: '1',
    Zeout: d.zeout, FirstName: d.first, LastName: d.last,
    Street: '', City: isTest ? 'נתיבות' : '', Phone: d.phone, Mail: d.mail,
    Amount: String(s.amount),
    Tashlumim: s.freq === 'monthly' ? s.months : String(s.payments),
    Day: '', StartFrom: '',
    Groupe: s.groupe, Comment: comment(s),
    Param1: '', Param2: '', ForceUpdateMatching: '', ThirdPartyReceipt: '',
    CallBack: '', CallBackMailError: '', Tokef: '',
  };
}

// Nedarim answers some failures with a code instead of Hebrew text
const NEDARIM_CODES = {
  'NEED ZEOUT': ['zeout', 'נדרש מספר תעודת זהות של בעל הכרטיס'],
  'NEED CAPTCHA': [null, 'נא לסמן "אני לא רובוט" בטופס התשלום וללחוץ שוב'],
  'CAPTCHA ERROR': [null, 'אימות "אני לא רובוט" נכשל — נא לסמן שוב וללחוץ שוב'],
};

function onResult(v) {
  if (!pending) return;
  const s = pending;
  pending = null;
  if (v.Status === 'OK') { showThanks(s, v); return; }
  setBusy(false);
  post({ Name: 'GetHeight' });
  const raw = String(v.Message || v.BackMessage || '').trim();
  const [field, text] = NEDARIM_CODES[raw.toUpperCase()] || [null, raw || 'התרומה לא בוצעה'];
  if (field) { setErr(field, text); form.elements[field].focus(); }
  showAlert(`${text.replace(/[.\s]+$/, '')}. לא בוצע חיוב — אפשר לתקן ולנסות שוב.`);
}

/* ---------- thanks ---------- */
function showThanks(s, v) {
  form.hidden = true;
  const t = el.thanks;
  if (s) {
    const d = donor();
    $('[data-thanks-title]', t).textContent = `תודה רבה, ${d.first}!`;
    $('[data-thanks-sum]', t).textContent = s.freq === 'monthly'
      ? `הוראת הקבע על סך ${fmt(s.amount)} ₪ לחודש הוקמה בהצלחה.`
      : `תרומתך על סך ${fmt(s.amount)} ₪${s.payments > 1 ? ` (${s.payments} תשלומים)` : ''} התקבלה בהצלחה.`;
    const meta = s.freq === 'monthly'
      ? (v.NextDate ? `החיוב הראשון: ${v.NextDate}` : '')
      : (v.Confirmation ? `מספר אישור: ${v.Confirmation}` : '');
    $('[data-thanks-meta]', t).textContent = meta;
    $('[data-thanks-receipt]', t).hidden = !d.mail;
  } else {
    $('[data-thanks-sum]', t).textContent = 'התרומה התקבלה בהצלחה.';
  }
  const site = new URL('../', location.href).href;
  $('[data-share]', t).href = 'https://wa.me/?text=' + encodeURIComponent('הצטרפו אליי לשותפות במפעל החסד של ארגון חסד יסובבנו: ' + site);
  t.hidden = false;
  window.scrollTo({ top: 0 });
  t.focus();
}

if (params.has('thanks')) showThanks(null, {});
render();
