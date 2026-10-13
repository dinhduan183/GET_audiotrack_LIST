const $ = id => document.getElementById(id);
const CONCURRENCY = 3;
const PAGE_SIZE = 50;
const WAITING = 0, SCANNING = 1, DONE = 2;

let results = [];
let scanState = [];
let page = 0;
let cursor = 0;
let channelName = '';
let controller = null;

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
    tr.innerHTML = `<td class="num">${i + 1}</td><td class="muted" colspan="5"></td>`;
    tr.lastChild.textContent = `${v.id} — ${scanState[i] === SCANNING ? 'đang quét…' : 'đang chờ…'}`;
    return tr;
  }
  const add = (cls, node) => { const td = document.createElement('td'); if (cls) td.className = cls; td.append(node); tr.append(td); };
  add('num', String(i + 1));

  const a = document.createElement('a');
  a.href = `https://www.youtube.com/watch?v=${v.id}`;
  a.target = '_blank';
  a.textContent = v.title || v.id;
  add('title', a);

  add('date', v.date || '');
  add('num', Number.isFinite(v.views) ? v.views.toLocaleString('vi-VN') : '');

  add('num', v.tracks ? String(v.tracks.length) : '');

  const cell = document.createElement('span');
  if (v.tracks) {
    cell.className = 'tracks';
    for (const t of v.tracks) {
      const s = document.createElement('span');
      s.className = 'chip' + (t.isOriginal ? ' orig' : '');
      s.textContent = t.name;
      cell.append(s);
    }
  } else {
    cell.className = v.error ? 'err' : 'muted';
    cell.textContent = trackText(v);
  }
  add('', cell);
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
  renderPage();
  $('start').disabled = true;
  $('stop').disabled = false;
  $('csv').disabled = true;

  try {
    setStatus('Đang lấy danh sách video…');
    const list = await listChannelVideos(input, limit, sort, n => setStatus(`Đang lấy danh sách video… ${n}`), signal);
    channelName = list.channel;
    const ids = list.ids;
    if (!ids.length) { setStatus('Kênh không có video public.'); return; }

    results = ids.map(id => ({ id }));
    scanState = ids.map(() => WAITING);
    renderPage();

    let done = 0;
    setStatus(`${channelName}: đã quét 0/${ids.length} video`);
    const worker = async () => {
      while (!signal.aborted) {
        const i = pickNext();
        if (i < 0) return;
        scanState[i] = SCANNING;
        updateRow(i);
        try {
          results[i] = await getVideoInfo(ids[i], signal);
        } catch (e) {
          if (signal.aborted) { scanState[i] = WAITING; updateRow(i); return; }
          results[i] = { id: ids[i], error: e.message };
        }
        scanState[i] = DONE;
        updateRow(i);
        done++;
        setStatus(`${channelName}: đã quét ${done}/${ids.length} video`);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setStatus(signal.aborted
      ? `${channelName}: đã dừng ở ${done}/${ids.length} video`
      : `${channelName}: xong ${ids.length} video`);
  } catch (e) {
    if (signal.aborted) setStatus('Đã dừng.');
    else setStatus('Lỗi: ' + e.message, true);
  } finally {
    $('start').disabled = false;
    $('stop').disabled = true;
    $('csv').disabled = !results.some(v => v.title || v.error);
  }
}

function exportCsv() {
  const esc = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const lines = [['#', 'Title', 'Ngày public', 'View', 'Số audio track', 'Audio tracks', 'Link'].map(esc).join(',')];
  results.forEach((v, i) => {
    if (!v.title && !v.error) return;
    lines.push([
      i + 1, v.title, v.date, Number.isFinite(v.views) ? v.views : '',
      v.tracks ? v.tracks.length : '', trackText(v),
      `https://www.youtube.com/watch?v=${v.id}`,
    ].map(esc).join(','));
  });
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(channelName || 'channel').replace(/[\\/:*?"<>|]/g, '_')}_audio_tracks.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

$('form').addEventListener('submit', e => {
  e.preventDefault();
  const limit = parseInt($('limit').value, 10);
  run($('url').value, limit > 0 ? limit : 0, $('sort').value);
});
$('stop').addEventListener('click', () => controller?.abort());
$('csv').addEventListener('click', exportCsv);
$('prev').addEventListener('click', () => goToPage(page - 1));
$('next').addEventListener('click', () => goToPage(page + 1));
