# Privacy Policy — YouTube Audio Tracks

Last updated: November 19, 2026

YouTube Audio Tracks is a Chrome extension that lists the public videos of a YouTube channel (or a single video) with their audio tracks, and warns when a video is missing languages from a preset you define.

## What data the extension accesses

- **YouTube page content**: when you start a scan, the extension loads pages from `youtube.com` (the channel's Videos tab and each video's watch page) to read public information: video ID, title, publish date, view count, channel name and avatar, and the list of audio tracks.
- **Your YouTube session**: requests are sent from your browser to `youtube.com` with your existing YouTube session, the same as when you open YouTube yourself. The extension does not read, store or transmit your password, cookies or account details.

## What data is stored

The following is stored only in your browser on your device (the extension page's local storage):

- links you have scanned (with channel name/avatar or video title/thumbnail URL),
- your language presets,
- the language names YouTube displays for each language code, and whether your YouTube interface is in English or Vietnamese.

Scan results are kept only in the open tab and are discarded when you close it. Uninstalling the extension removes all stored data.

## What data is shared

None. The extension does not send any data to the developer or to any third party. It does not use analytics, tracking or advertising. The only network requests it makes go to `youtube.com`.

## Permissions

- `https://www.youtube.com/*` — to read the public YouTube pages described above.
- `declarativeNetRequestWithHostAccess` — to set the `Origin` header to `https://www.youtube.com` on requests that the extension itself sends to YouTube, because YouTube rejects requests with a `chrome-extension://` origin. It does not affect any other request.

## Contact

Questions about this policy: open an issue at https://github.com/dinhduan183/GET_audiotrack_LIST/issues

---

# Chính sách quyền riêng tư — YouTube Audio Tracks

Cập nhật: 19/11/2026

- Extension chỉ đọc nội dung công khai trên `youtube.com` (danh sách video, title, ngày đăng, lượt xem, audio track) bằng phiên đăng nhập YouTube sẵn có trong trình duyệt của bạn; không đọc, lưu hay gửi đi mật khẩu, cookie hay thông tin tài khoản.
- Link đã quét, preset ngôn ngữ và tên ngôn ngữ chỉ được lưu trong trình duyệt trên máy bạn. Kết quả quét mất khi đóng tab. Gỡ extension là xoá hết dữ liệu.
- Extension không gửi dữ liệu nào cho nhà phát triển hay bên thứ ba, không dùng analytics, theo dõi hay quảng cáo.
- Liên hệ: https://github.com/dinhduan183/GET_audiotrack_LIST/issues
