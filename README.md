# GET_audiotrack_LIST

Extension Chrome liệt kê toàn bộ video public của một kênh YouTube, kèm:

- Title
- Ngày public
- Lượt xem (View)
- Số audio track và danh sách các audio track (ngôn ngữ lồng tiếng) của từng video

Extension dùng phiên đăng nhập YouTube sẵn có trong trình duyệt, không cần API key, không cần nhập cookie.

## Cài đặt

1. Tải code về máy, chọn một trong hai cách:
   - Trên trang GitHub bấm **Code → Download ZIP**, rồi giải nén.
   - Hoặc dùng git:
     ```bash
     git clone https://github.com/dinhduan183/GET_audiotrack_LIST.git
     ```
2. Mở Chrome, vào địa chỉ `chrome://extensions`.
3. Bật **Developer mode** (góc trên bên phải).
4. Bấm **Load unpacked**, chọn thư mục vừa tải về (thư mục chứa file `manifest.json`).
5. Extension **YouTube Audio Tracks** xuất hiện trong danh sách. Nên ghim icon ra thanh công cụ cho tiện (biểu tượng mảnh ghép → ghim).

## Cách dùng

1. Bấm icon extension, một tab mới mở ra.
2. Dán link kênh vào ô **Link kênh**. Các dạng link đều được:
   - `https://www.youtube.com/@TenKenh`
   - `https://www.youtube.com/channel/UCxxxxxxxx`
   - `https://www.youtube.com/c/TenKenh`, `https://www.youtube.com/user/TenKenh`
   - hoặc chỉ `@TenKenh`
3. Ô **Số video**: để trống để lấy tất cả video, hoặc nhập N để chỉ lấy N video đầu tiên theo thứ tự sắp xếp.
4. Ô **Sắp xếp**: **Mới nhất**, **Phổ biến** (nhiều view nhất) hoặc **Cũ nhất**, giống bộ lọc ở tab Videos của kênh.
5. Bấm **Bắt đầu**. Bấm **Dừng** nếu muốn dừng giữa chừng.
6. Bấm **Xuất CSV** để tải kết quả về (mở được bằng Excel). Muốn đủ toàn kênh thì đợi quét xong rồi mới xuất.

### Kênh nhiều video

- Bảng chia trang, mỗi trang 50 video, chuyển trang bằng **‹ Trước** / **Sau ›**.
- Việc quét chạy liên tục ở nền. Chuyển sang trang nào thì các video trên trang đó được ưu tiên quét trước.

### Đọc kết quả

| Cột | Ý nghĩa |
|---|---|
| Số track | Số audio track của video. **0** = video chỉ có âm thanh gốc, kênh chưa thêm track lồng tiếng. |
| Audio tracks | Các ngôn ngữ, xếp A→Z. Ngôn ngữ **in đậm** là track gốc của video. |

Dòng ghi **Lỗi** (chữ đỏ) là video tải không được, chưa xác định được audio track. Có thể quét lại sau.

## Lưu ý

- Chỉ lấy video ở tab **Videos** của kênh, không gồm Shorts và Live.
- Nếu kênh chặn IP Việt Nam thì bật VPN trước khi quét.
- Quét kênh rất lớn liên tục có thể bị YouTube giới hạn tạm thời (lỗi 429). Đợi một lúc rồi chạy lại.
- Tên ngôn ngữ hiển thị theo ngôn ngữ giao diện YouTube của tài khoản bạn.
- Kết quả chỉ nằm trong tab đang mở, đóng tab là mất. Cần giữ lại thì xuất CSV.

## Cập nhật bản mới

1. Tải lại code (Download ZIP mới, hoặc `git pull` trong thư mục đã clone).
2. Vào `chrome://extensions`, bấm nút ↻ (Reload) ở thẻ YouTube Audio Tracks.
