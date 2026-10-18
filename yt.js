// Lấy dữ liệu từ youtube.com bằng cookie đăng nhập sẵn của trình duyệt.
const YT = 'https://www.youtube.com';

async function fetchText(url, signal) {
  const r = await fetch(url, { credentials: 'include', signal });
  if (!r.ok) throw new Error(`HTTP ${r.status} khi tải ${url}`);
  return r.text();
}

// Cắt object JSON đứng ngay sau `marker` trong HTML.
function extractJsonAfter(text, marker) {
  const i = text.indexOf(marker);
  if (i < 0) return null;
  const start = text.indexOf('{', i + marker.length);
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let j = start; j < text.length; j++) {
    const c = text[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return JSON.parse(text.slice(start, j + 1));
  }
  return null;
}

// Chuẩn hoá mọi dạng link kênh về tab /videos.
function channelVideosUrl(input) {
  let s = input.trim();
  if (s.startsWith('@')) s = `${YT}/${s}`;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  const u = new URL(s);
  if (!/(^|\.)youtube\.com$/i.test(u.hostname)) throw new Error('Link không phải youtube.com');
  const seg = u.pathname.split('/').filter(Boolean);
  let base;
  if (seg[0]?.startsWith('@')) base = seg[0];
  else if (['channel', 'c', 'user'].includes(seg[0]) && seg[1]) base = `${seg[0]}/${seg[1]}`;
  else if (seg[0] && seg[0] !== 'watch') base = seg[0];
  else throw new Error('Không nhận ra link kênh');
  return `${YT}/${base}/videos`;
}

// Trả về id video nếu input là link một video (watch, youtu.be, shorts, live, embed), ngược lại null.
function videoIdFromInput(input) {
  let s = input.trim();
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  let u;
  try { u = new URL(s); } catch { return null; }
  const seg = u.pathname.split('/').filter(Boolean);
  let id = null;
  if (/(^|\.)youtu\.be$/i.test(u.hostname)) id = seg[0];
  else if (/(^|\.)youtube\.com$/i.test(u.hostname)) {
    if (seg[0] === 'watch') id = u.searchParams.get('v');
    else if (['shorts', 'live', 'embed'].includes(seg[0])) id = seg[1];
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

function collectVideos(node, out) {
  if (Array.isArray(node)) { for (const n of node) collectVideos(n, out); return; }
  if (!node || typeof node !== 'object') return;
  if (node.videoRenderer?.videoId) out.ids.push(node.videoRenderer.videoId);
  else if (node.lockupViewModel?.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO') out.ids.push(node.lockupViewModel.contentId);
  const tok = node.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
  if (tok) out.token = tok;
  for (const k in node) collectVideos(node[k], out);
}

// Thứ tự nút lọc ở tab Videos: Mới nhất, Phổ biến, Cũ nhất (chữ trên nút đổi theo ngôn ngữ nên dùng vị trí).
const SORT_CHIP_INDEX = { latest: 0, popular: 1, oldest: 2 };

// Trả về { channel, avatar, ids } — id video public ở tab Videos, theo thứ tự `sort`.
async function listChannelVideos(input, limit, sort, onProgress, signal) {
  const html = await fetchText(channelVideosUrl(input), signal);
  const data = extractJsonAfter(html, 'var ytInitialData = ') || extractJsonAfter(html, 'window["ytInitialData"] = ');
  if (!data) throw new Error('Không đọc được trang kênh');
  const channel = data.metadata?.channelMetadataRenderer?.title || '';
  const avatar = data.metadata?.channelMetadataRenderer?.avatar?.thumbnails?.at(-1)?.url || '';
  const tab = data.contents?.twoColumnBrowseResultsRenderer?.tabs
    ?.map(t => t.tabRenderer).find(t => t?.selected);
  const tabUrl = tab?.endpoint?.commandMetadata?.webCommandMetadata?.url || '';
  if (!tab || !tabUrl.endsWith('/videos')) throw new Error('Kênh không có tab Videos');

  const apiKey = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
  const context = extractJsonAfter(html, '"INNERTUBE_CONTEXT":');
  const clientVersion = context?.client?.clientVersion;

  const ids = [], seen = new Set();
  const add = out => {
    for (const id of out.ids) if (!seen.has(id)) { seen.add(id); ids.push(id); }
  };
  let out = { ids: [], token: null };
  if (sort && sort !== 'latest') {
    const chips = tab.content?.richGridRenderer?.header?.chipBarViewModel?.chips;
    const token = chips?.[SORT_CHIP_INDEX[sort]]?.chipViewModel?.tapCommand?.innertubeCommand?.continuationCommand?.token;
    if (!token) throw new Error('Kênh này không có bộ lọc sắp xếp, hãy chọn "Mới nhất"');
    out.token = token;
  } else {
    collectVideos(tab.content, out);
    add(out);
    onProgress?.(ids.length);
  }

  while (out.token && (!limit || ids.length < limit)) {
    const r = await fetch(`${YT}/youtubei/v1/browse?prettyPrint=false${apiKey ? '&key=' + apiKey : ''}`, {
      method: 'POST',
      credentials: 'include',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Youtube-Client-Name': '1',
        ...(clientVersion && { 'X-Youtube-Client-Version': clientVersion }),
      },
      body: JSON.stringify({ context, continuation: out.token }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} khi tải thêm danh sách video`);
    const json = await r.json();
    out = { ids: [], token: null };
    collectVideos(json.onResponseReceivedActions || json.onResponseReceivedCommands || json, out);
    const before = ids.length;
    add(out);
    onProgress?.(ids.length);
    if (ids.length === before) break;
  }
  return { channel, avatar, ids: limit ? ids.slice(0, limit) : ids };
}

// Title, ngày public, view, audio track của một video.
async function getVideoInfo(id, signal) {
  const html = await fetchText(`${YT}/watch?v=${id}&bpctr=9999999999&has_verified=1`, signal);
  const p = extractJsonAfter(html, 'var ytInitialPlayerResponse = ');
  if (!p) throw new Error('Không đọc được trang video');
  const vd = p.videoDetails || {};
  const mf = p.microformat?.playerMicroformatRenderer || {};
  const status = p.playabilityStatus?.status || '';

  let tracks = null; // null = không xác định được
  if (p.streamingData) {
    const map = new Map();
    for (const f of p.streamingData.adaptiveFormats || []) {
      const t = f.audioTrack;
      // Track gốc có id dạng "<ngôn ngữ>.4" (track lồng tiếng là ".3"). audioIsDefault thì
      // phụ thuộc cài đặt ngôn ngữ của người xem nên không dùng.
      if (t && !map.has(t.id)) map.set(t.id, { name: t.displayName, isOriginal: /\.4$/.test(t.id) || /original/i.test(t.displayName) });
    }
    // Xếp A→Z theo tên, giống menu Audio track của YouTube.
    tracks = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  return {
    id,
    title: vd.title || mf.title?.simpleText || '',
    date: (mf.publishDate || mf.uploadDate || '').slice(0, 10),
    views: Number(vd.viewCount ?? mf.viewCount ?? NaN),
    tracks,
    status: status === 'OK' ? '' : (p.playabilityStatus?.reason || status),
  };
}
