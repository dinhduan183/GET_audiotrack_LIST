const $ = id => document.getElementById(id);
const CONCURRENCY = 3;
const PAGE_SIZE = 50;
const WAITING = 0, SCANNING = 1, DONE = 2;

let results = [];
let scanState = [];
let page = 0;
let cursor = 0;
let channelName = '';
let scanChannelUrl = ''; // link kênh đang quét ('' nếu quét một video)
let controller = null;

// Danh sách link đã quét, lưu trong localStorage: [{ url, kind: 'channel'|'video', name, image }], mới nhất trước.
const SAVED_KEY = 'savedLinks';

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY)) || []; } catch { return []; }
}

function saveLink(entry) {
  const list = loadSaved().filter(x => x.url !== entry.url);
  list.unshift(entry);
  localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  renderSaved();
}

function renderSaved() {
  const list = loadSaved();
  $('saved').hidden = !list.length;
  const box = $('savedList');
  box.innerHTML = '';
  for (const x of list) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'saved-item ' + x.kind;
    b.title = x.url;
    if (x.image) {
      const img = document.createElement('img');
      img.src = x.image;
      img.alt = '';
      b.append(img);
    }
    const name = document.createElement('span');
    name.textContent = x.name || x.url;
    b.append(name);
    const del = document.createElement('span');
    del.className = 'saved-del';
    del.textContent = '×';
    del.title = 'Xoá';
    del.addEventListener('click', e => {
      e.stopPropagation();
      localStorage.setItem(SAVED_KEY, JSON.stringify(loadSaved().filter(y => y.url !== x.url)));
      renderSaved();
    });
    b.append(del);
    b.addEventListener('click', () => {
      $('url').value = x.url;
      $('url').focus();
      // Link kênh: tự chọn preset đã lưu cho kênh đó; kênh chưa có preset thì về "Không dùng".
      if (x.kind === 'channel') {
        const presets = loadPresets();
        const p = presets.find(p => p.channelUrl === x.url) || presets.find(p => p.name === x.name);
        setActivePreset(p ? p.name : '');
      }
    });
    box.append(b);
  }
}

// Preset ngôn ngữ cần có: [{ name, langs: [...] }]. Video thiếu ngôn ngữ nào trong preset đang chọn thì cảnh báo.
const PRESET_KEY = 'presets';
const ACTIVE_PRESET_KEY = 'activePreset';

// Preset lưu khoá ngôn ngữ (xem textKey). Preset cũ lưu tên thì đổi sang khoá khi đọc.
function loadPresets() {
  let list;
  try { list = JSON.parse(localStorage.getItem(PRESET_KEY)) || []; } catch { list = []; }
  return list.map(p => ({ ...p, langs: [...new Set(p.langs.map(textKey).filter(Boolean))] }));
}

function savePresets(list, focus) {
  localStorage.setItem(PRESET_KEY, JSON.stringify(list));
  renderPresets(focus);
}

function activePreset() {
  const name = localStorage.getItem(ACTIVE_PRESET_KEY);
  return loadPresets().find(p => p.name === name) || null;
}

// --- Nhận diện ngôn ngữ -------------------------------------------------------------------------
// Mỗi ngôn ngữ được nhận diện bằng một "khoá" theo mã ngôn ngữ YouTube, không theo tên hiển thị:
//   "en-US" = English (US) / Tiếng Anh (Mỹ), "pt-BR" = Portuguese (Brazil), "en-US#d" = bản mô tả.
// Track lấy mã từ id của YouTube (vd "en-US.4"), nên giao diện YouTube tiếng gì cũng so khớp đúng.
// Tên gõ tay được tra mã qua languages.js và các tên YouTube đã gặp khi quét.
// Tên không tra được thì khoá là "?tên" (so theo chữ).

// Bỏ nhãn track gốc: "English (original)", "English (US) original", "Tiếng Anh (gốc)".
const cleanLang = s => s.replace(/\s*\((original|gốc)\)/gi, '').replace(/\s+(original|gốc)$/i, '').trim();
// Nhãn track mô tả: "English descriptive", "English (descriptive)", "Tiếng Anh (mô tả)".
const DESC_RE = /\s*\((descriptive|mô tả)\)|\s+(descriptive|mô tả)$/i;
const isDescriptive = s => DESC_RE.test(cleanLang(s));
const baseLang = s => cleanLang(s).replace(DESC_RE, '').trim();
const bareVn = s => s.toLowerCase().replace(/^tiếng\s+/, '').trim();

const LANG_BY_CODE = new Map(LANGUAGES.map(l => [l.code, l]));

// Tên YouTube đã gặp khi quét, theo mã và ngôn ngữ giao diện: { "en-US": { en: "English (US)", vi: "Tiếng Anh (Mỹ)" } }
const LANG_NAMES_KEY = 'ytLangNames';
let learnedNames = {};
try { learnedNames = JSON.parse(localStorage.getItem(LANG_NAMES_KEY)) || {}; } catch { learnedNames = {}; }

// Bảng tra tên (thường) → mã: tên YouTube đã gặp được ưu tiên hơn tên trong languages.js.
let nameToCode = new Map();
function buildNameLookup() {
  nameToCode = new Map();
  const put = (name, code) => {
    if (!name) return;
    const k = name.toLowerCase();
    if (!nameToCode.has(k)) nameToCode.set(k, code);
    const b = bareVn(name);
    if (!nameToCode.has(b)) nameToCode.set(b, code);
  };
  for (const [code, n] of Object.entries(learnedNames)) { put(n.en, code); put(n.vi, code); }
  for (const l of LANGUAGES) { put(l.name, l.code); put(l.nameVn, l.code); }
}
buildNameLookup();

const isKey = s => s.startsWith('?') || LANG_BY_CODE.has(s.replace(/#d$/, '')) || !!learnedNames[s.replace(/#d$/, '')];

// Khoá của một track YouTube.
function trackKey(t) {
  const code = t.code || textKey(baseLang(t.name)).replace(/#d$/, '');
  return code + (isDescriptive(t.name) ? '#d' : '');
}

// Khoá của một tên gõ tay (tiếng Anh hoặc tiếng Việt) hoặc một khoá có sẵn.
function textKey(text) {
  let t = text.trim();
  if (!t) return '';
  if (t.startsWith('?')) t = t.slice(1).replace(/#d$/, m => ' descriptive'); // thử tra lại khoá chưa có mã
  else if (isKey(t)) return t;
  const base = baseLang(t);
  // YouTube hay viết tắt tên vùng: "English (US)" = "English (United States)" trong languages.js.
  const long = base.toLowerCase().replace(/\((us|mỹ)\)/, m => m === '(us)' ? '(united states)' : '(hoa kỳ)')
    .replace(/\(uk\)/, '(united kingdom)');
  const code = [base.toLowerCase(), bareVn(base), long, bareVn(long)].map(k => nameToCode.get(k)).find(Boolean);
  return (code || '?' + base) + (isDescriptive(t) ? '#d' : '');
}

// Ngôn ngữ giao diện YouTube ('vi' | 'en'), đoán từ tên track lúc quét. Dùng để hiển thị
// khối preset, khối đỏ và gợi ý cùng ngôn ngữ với bảng kết quả.
const UI_LANG_KEY = 'ytUiLang';
let uiLang = localStorage.getItem(UI_LANG_KEY) || 'en';
const VN_NAMES = new Set(LANGUAGES.map(l => l.nameVn.toLowerCase()));

function trackUiLang(t) {
  const b = baseLang(t.name).toLowerCase();
  return /^tiếng\s/.test(b) || VN_NAMES.has(b) ? 'vi' : 'en';
}

// Sau mỗi video quét xong: đoán ngôn ngữ giao diện và ghi nhớ tên YouTube của từng mã.
function learnFromTracks(tracks) {
  if (!tracks?.length) return;
  const lang = tracks.some(t => trackUiLang(t) === 'vi') ? 'vi' : 'en';
  let changed = false;
  for (const t of tracks) {
    if (!t.code || isDescriptive(t.name)) continue;
    const name = baseLang(t.name);
    const entry = learnedNames[t.code] || (learnedNames[t.code] = {});
    if (entry[lang] !== name) { entry[lang] = name; changed = true; }
  }
  if (changed) {
    localStorage.setItem(LANG_NAMES_KEY, JSON.stringify(learnedNames));
    buildNameLookup();
  }
  if (lang !== uiLang) {
    uiLang = lang;
    localStorage.setItem(UI_LANG_KEY, uiLang);
    changed = true;
  }
  if (changed) {
    renderPresets();
    renderPage();
  }
}

// Tên một khoá trong một ngôn ngữ: ưu tiên tên YouTube đã gặp, sau đó languages.js.
function keyName(key, lang = uiLang) {
  if (key.startsWith('?')) return key.slice(1).replace(/#d$/, '');
  const code = key.replace(/#d$/, '');
  const l = LANG_BY_CODE.get(code);
  const base = learnedNames[code]?.[lang] || (l && (lang === 'vi' ? l.nameVn : l.name)) || code;
  if (!key.endsWith('#d')) return base;
  return lang === 'vi' ? `${base} (mô tả)` : `${base} descriptive`;
}

const displayLang = key => keyName(key);
const byDisplay = (a, b) => displayLang(a).localeCompare(displayLang(b));

function missingLangs(v) {
  const p = activePreset();
  if (!p || !v.tracks) return [];
  const have = new Set(v.tracks.map(trackKey));
  return p.langs.filter(k => !have.has(k));
}

// Gợi ý trong ô thêm ngôn ngữ: mọi ngôn ngữ trong languages.js và đã gặp khi quét, kèm bản mô tả.
// Tên chính theo giao diện YouTube, tên ngôn ngữ còn lại làm mô tả; bỏ những ngôn ngữ preset đã có.
function renderLangOptions(_, exclude = activePreset()?.langs || []) {
  const skip = new Set(exclude);
  const other = uiLang === 'vi' ? 'en' : 'vi';
  const codes = new Set([...LANGUAGES.map(l => l.code), ...Object.keys(learnedNames)]);
  const opts = [];
  for (const code of codes) for (const key of [code, code + '#d']) {
    if (skip.has(key)) continue;
    opts.push({ value: keyName(key), label: keyName(key, other) });
  }
  const dl = $('langOptions');
  dl.innerHTML = '';
  for (const { value, label } of opts.sort((a, b) => a.value.localeCompare(b.value))) {
    const o = document.createElement('option');
    o.value = value;
    if (label && label !== value) o.label = label;
    dl.append(o);
  }
}

function updateWarnCount() {
  const n = results.filter(v => missingLangs(v).length).length;
  $('warnCount').textContent = n ? `⚠ ${n} video thiếu ngôn ngữ trong preset "${activePreset().name}" (khối đỏ nhấp nháy)` : '';
}

function refreshWarnings() {
  renderPage();
  updateWarnCount();
}

// Tên preset không trùng: "Tên", "Tên (2)", "Tên (3)"…
function uniquePresetName(base, list = loadPresets()) {
  base = base.trim() || 'Preset';
  let name = base;
  for (let n = 2; list.some(p => p.name === name); n++) name = `${base} (${n})`;
  return name;
}

function setActivePreset(name, focus) {
  localStorage.setItem(ACTIVE_PRESET_KEY, name || '');
  renderPresets(focus);
  refreshWarnings();
}

function updatePreset(name, change, focus) {
  savePresets(loadPresets().map(p => p.name === name ? { ...p, ...change(p) } : p), focus);
  refreshWarnings();
}

// Gõ tên tiếng Anh hoặc tiếng Việt ("Nhật", "Tiếng Anh (Mỹ)") đều đổi về khoá ngôn ngữ.
function addLangs(name, text) {
  const keys = text.split(',').map(textKey).filter(Boolean);
  if (!keys.length) return;
  updatePreset(name, p => ({ langs: [...new Set([...p.langs, ...keys])] }), 'tag');
}

// Tạo preset từ các ngôn ngữ của một video, chọn luôn và cho sửa tên ngay.
function presetFromVideo(v) {
  const list = loadPresets();
  const langs = [...new Set(v.tracks.map(trackKey))];
  // Quét kênh: tên preset là tên kênh và gắn với link kênh. Quét một video: tên là title video.
  const name = scanChannelUrl && channelName ? channelName : (v.title || v.id).slice(0, 60);
  const idx = list.findIndex(p => p.name === name);
  if (idx >= 0 && !confirm(`Đã có preset "${name}".\n\nXoá preset cũ và thay bằng các ngôn ngữ của video này?`)) return;
  const preset = { name, langs, ...(scanChannelUrl && { channelUrl: scanChannelUrl }) };
  if (idx >= 0) list[idx] = preset; else list.push(preset);
  localStorage.setItem(PRESET_KEY, JSON.stringify(list));
  setActivePreset(name);
  $('presetTabs').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// focus: 'tag' = ô thêm ngôn ngữ, 'new' = ô tạo preset mới, 'rename' = sửa tên preset đang chọn.
function renderPresets(focus) {
  const list = loadPresets();
  const active = activePreset();

  // Hàng "Preset": Không dùng | các preset | + Tạo preset
  const tabs = $('presetTabs');
  tabs.innerHTML = '';
  const off = el('button', 'ptab' + (active ? '' : ' active'), 'Không dùng');
  off.type = 'button';
  off.addEventListener('click', () => setActivePreset(''));
  tabs.append(off);

  // Ô nhập tên dùng chung cho "tạo mới" và "đổi tên". onDone(name) chỉ gọi khi có tên hợp lệ.
  let nameInputToFocus = null;
  const nameField = (value, placeholder, onDone) => {
    const input = el('input', 'ptab-input');
    input.value = value;
    input.placeholder = placeholder;
    let finished = false;
    const finish = save => {
      if (finished) return;
      finished = true;
      const name = input.value.trim();
      if (save && name && name !== value) {
        if (loadPresets().some(p => p.name === name)) { alert(`Đã có preset "${name}".`); renderPresets(); return; }
        onDone(name);
      } else {
        renderPresets();
      }
    };
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      if (e.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(true));
    nameInputToFocus = input;
    return input;
  };

  for (const p of list) {
    if (focus === 'rename' && active?.name === p.name) {
      tabs.append(nameField(p.name, 'Tên preset', name => {
        localStorage.setItem(ACTIVE_PRESET_KEY, name);
        updatePreset(p.name, () => ({ name }));
      }));
      continue;
    }
    const b = el('button', 'ptab' + (active?.name === p.name ? ' active' : ''));
    b.type = 'button';
    b.append(el('span', '', p.name), el('span', 'ptab-count', String(p.langs.length)));
    b.title = [...p.langs].sort(byDisplay).map(displayLang).join(', ') || 'Chưa có ngôn ngữ';
    b.addEventListener('click', () => setActivePreset(p.name));
    tabs.append(b);
  }
  if (focus === 'new') {
    tabs.append(nameField('', 'Tên preset, Enter để tạo', name => {
      const all = loadPresets();
      all.push({ name, langs: [] });
      localStorage.setItem(PRESET_KEY, JSON.stringify(all));
      setActivePreset(name, 'tag');
    }));
  } else {
    const add = el('button', 'ptab ptab-add', '+ Tạo preset');
    add.type = 'button';
    add.addEventListener('click', () => renderPresets('new'));
    tabs.append(add);
    if (!list.length) tabs.append(el('span', 'tabs-hint', 'hoặc bấm "Lưu thành mẫu" ở một video đã quét'));
  }

  if (nameInputToFocus) { nameInputToFocus.focus(); nameInputToFocus.select(); }

  // Hàng "Ngôn ngữ" của preset đang chọn
  const ed = $('presetEditor');
  ed.innerHTML = '';
  $('langRow').hidden = !active;
  if (!active) return;

  const box = el('div', 'tagbox');
  for (const l of [...active.langs].sort(byDisplay)) {
    const c = el('span', 'chip', displayLang(l));
    const x = el('button', 'chip-del', '×');
    x.type = 'button';
    x.title = `Bỏ ${displayLang(l)}`;
    x.addEventListener('click', () => updatePreset(active.name, p => ({ langs: p.langs.filter(z => z !== l) }), 'tag'));
    c.append(x);
    box.append(c);
  }
  const tag = el('input', 'tag-input');
  tag.placeholder = active.langs.length ? 'Thêm ngôn ngữ…' : 'Gõ tên ngôn ngữ rồi Enter, ví dụ French hoặc Tiếng Pháp';
  tag.setAttribute('list', 'langOptions');
  tag.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addLangs(active.name, tag.value); }
    if (e.key === 'Backspace' && !tag.value && active.langs.length) {
      const last = [...active.langs].sort(byDisplay).at(-1);
      updatePreset(active.name, p => ({ langs: p.langs.filter(z => z !== last) }), 'tag');
    }
  });
  // Chọn một gợi ý trong danh sách thì thêm luôn.
  tag.addEventListener('input', e => {
    if (e.inputType === 'insertReplacementText' || e.inputType === undefined) addLangs(active.name, tag.value);
  });
  box.addEventListener('click', e => { if (e.target === box) tag.focus(); });
  box.append(tag);

  const actions = el('div', 'preset-actions');
  const rename = el('button', 'link-btn', 'Đổi tên');
  rename.type = 'button';
  rename.addEventListener('click', () => renderPresets('rename'));
  const del = el('button', 'link-btn danger', 'Xoá preset');
  del.type = 'button';
  del.addEventListener('click', () => {
    if (!confirm(`Xoá preset "${active.name}"?`)) return;
    localStorage.setItem(PRESET_KEY, JSON.stringify(loadPresets().filter(p => p.name !== active.name)));
    setActivePreset('');
  });
  actions.append(rename, del);

  ed.append(box, actions);
  renderLangOptions(undefined, active.langs);
  if (focus === 'tag') tag.focus();
}

function setStatus(msg, isErr = false) {
  $('status').textContent = msg;
  $('status').className = isErr ? 'err' : '';
}

function trackText(v) {
  if (v.error) return 'Lỗi: ' + v.error;
  if (v.tracks === null) return v.status || 'Không xác định';
  return v.tracks.map(t => t.name + (t.isOriginal && !/original/i.test(t.name) ? ' (gốc)' : '')).join(', ');
}

function buildRow(i) {
  const v = results[i];
  const tr = document.createElement('tr');
  if (scanState[i] !== DONE) {
    tr.innerHTML = `<td class="num">${i + 1}</td><td class="muted" colspan="7"></td>`;
    tr.lastChild.textContent = `${v.id} — ${scanState[i] === SCANNING ? 'đang quét…' : 'đang chờ…'}`;
    return tr;
  }
  const add = (cls, node) => { const td = document.createElement('td'); if (cls) td.className = cls; td.append(node); tr.append(td); };
  add('num', String(i + 1));

  const img = document.createElement('img');
  img.src = `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`;
  img.loading = 'lazy';
  img.alt = '';
  add('thumb', img);

  const a = document.createElement('a');
  a.href = `https://www.youtube.com/watch?v=${v.id}`;
  a.target = '_blank';
  a.textContent = v.title || v.id;
  add('title', a);

  add('date', v.date || '');
  add('num', Number.isFinite(v.views) ? v.views.toLocaleString('vi-VN') : '');

  add('num', v.tracks ? String(v.tracks.length) : '');

  const cell = document.createElement('span');
  const missing = missingLangs(v);
  if (v.tracks) {
    cell.className = 'tracks';
    // Ngôn ngữ thiếu so với preset xếp chung với track hiện có, A→Z.
    const chips = [...v.tracks, ...missing.map(name => ({ name: displayLang(name), missing: true }))]
      .sort((x, y) => x.name.localeCompare(y.name));
    for (const t of chips) {
      const s = document.createElement('span');
      s.className = 'chip' + (t.isOriginal ? ' orig' : '') + (t.missing ? ' missing' : '');
      s.textContent = t.name;
      if (t.missing) s.title = 'Thiếu so với preset';
      cell.append(s);
    }
  } else {
    cell.className = v.error ? 'err' : 'muted';
    cell.textContent = trackText(v);
  }
  if (missing.length) tr.className = 'warn';
  add('', cell);

  const btn = document.createElement('button');
  if (v.tracks?.length) {
    btn.type = 'button';
    btn.className = 'save-preset';
    btn.textContent = 'Lưu thành mẫu';
    btn.title = 'Tạo preset từ các ngôn ngữ của video này';
    btn.addEventListener('click', () => presetFromVideo(v));
    add('action', btn);
  } else {
    add('action', '');
  }
  return tr;
}

function pageCount() {
  return Math.max(1, Math.ceil(results.length / PAGE_SIZE));
}

function renderPage() {
  const start = page * PAGE_SIZE, end = Math.min(start + PAGE_SIZE, results.length);
  const rows = $('rows');
  rows.innerHTML = '';
  for (let i = start; i < end; i++) rows.append(buildRow(i));
  $('pageInfo').textContent = `Trang ${page + 1}/${pageCount()}`;
  $('prev').disabled = page === 0;
  $('next').disabled = page >= pageCount() - 1;
  $('pager').hidden = results.length <= PAGE_SIZE;
}

// Chỉ vẽ lại dòng `i` nếu nó đang nằm trên trang đang xem.
function updateRow(i) {
  const start = page * PAGE_SIZE;
  if (i < start || i >= start + PAGE_SIZE) return;
  const rows = $('rows');
  rows.replaceChild(buildRow(i), rows.children[i - start]);
}

function goToPage(p) {
  page = Math.min(Math.max(p, 0), pageCount() - 1);
  renderPage();
}

// Ưu tiên video chưa quét trên trang đang xem, sau đó quét tiếp theo thứ tự.
function pickNext() {
  const start = page * PAGE_SIZE, end = Math.min(start + PAGE_SIZE, results.length);
  for (let i = start; i < end; i++) if (scanState[i] === WAITING) return i;
  while (cursor < results.length && scanState[cursor] !== WAITING) cursor++;
  return cursor < results.length ? cursor : -1;
}

// YouTube trả 403 cho request POST có Origin chrome-extension://, nên đổi Origin thành youtube.com
// (chỉ áp dụng cho request do extension này gửi).
function fixOriginHeader() {
  return chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [1],
    addRules: [{
      id: 1,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{ header: 'Origin', operation: 'set', value: 'https://www.youtube.com' }],
      },
      condition: {
        requestDomains: ['youtube.com'],
        initiatorDomains: [chrome.runtime.id],
        resourceTypes: ['xmlhttprequest'],
      },
    }],
  });
}

async function run(input, limit, sort) {
  await fixOriginHeader();
  controller = new AbortController();
  const { signal } = controller;
  results = [];
  scanState = [];
  page = 0;
  cursor = 0;
  $('avatar').hidden = $('chName').hidden = true;
  renderPage();
  updateWarnCount();
  $('start').disabled = true;
  $('stop').disabled = false;

  try {
    const videoId = videoIdFromInput(input);
    let list;
    if (videoId) {
      list = { channel: '', avatar: '', ids: [videoId] };
    } else {
      setStatus('Đang lấy danh sách video…');
      list = await listChannelVideos(input, limit, sort, n => setStatus(`Đang lấy danh sách video… ${n}`), signal);
      saveLink({ url: input.trim(), kind: 'channel', name: list.channel, image: list.avatar });
    }
    channelName = list.channel || videoId || '';
    scanChannelUrl = videoId ? '' : input.trim();
    $('avatar').src = list.avatar;
    $('avatar').hidden = !list.avatar;
    $('chName').textContent = list.channel;
    $('chName').hidden = !list.channel;
    const ids = list.ids;
    if (!ids.length) { setStatus('Kênh không có video public.'); return; }

    results = ids.map(id => ({ id }));
    scanState = ids.map(() => WAITING);
    renderPage();

    let done = 0;
    setStatus(`Đã quét 0/${ids.length} video`);
    const worker = async () => {
      while (!signal.aborted) {
        const i = pickNext();
        if (i < 0) return;
        scanState[i] = SCANNING;
        updateRow(i);
        try {
          results[i] = await getVideoInfo(ids[i], signal);
          learnFromTracks(results[i].tracks);
        } catch (e) {
          if (signal.aborted) { scanState[i] = WAITING; updateRow(i); return; }
          results[i] = { id: ids[i], error: e.message };
        }
        scanState[i] = DONE;
        updateRow(i);
        done++;
        setStatus(`Đã quét ${done}/${ids.length} video`);
        updateWarnCount();
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    if (videoId && scanState[0] === DONE) {
      saveLink({ url: input.trim(), kind: 'video', name: results[0].title, image: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` });
    }
    setStatus(signal.aborted
      ? `Đã dừng ở ${done}/${ids.length} video`
      : `Xong ${ids.length} video`);
  } catch (e) {
    if (signal.aborted) setStatus('Đã dừng.');
    else setStatus('Lỗi: ' + e.message, true);
  } finally {
    $('start').disabled = false;
    $('stop').disabled = true;
  }
}

$('form').addEventListener('submit', e => {
  e.preventDefault();
  const limit = parseInt($('limit').value, 10);
  localStorage.setItem('lastUrl', $('url').value);
  run($('url').value, limit > 0 ? limit : 0, $('sort').value);
});
localStorage.removeItem('trackHistory'); // dữ liệu của tính năng so sánh phiên trước đã bỏ
localStorage.removeItem('knownLangs'); // thay bằng ytLangNames
$('url').value = localStorage.getItem('lastUrl') || '';
renderSaved();
renderPresets();
renderLangOptions();
$('stop').addEventListener('click', () => controller?.abort());
$('prev').addEventListener('click', () => goToPage(page - 1));
$('next').addEventListener('click', () => goToPage(page + 1));
