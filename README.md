# GET_audiotrack_LIST

Extension Chrome liệt kê toàn bộ video public của một kênh YouTube, kèm:

- Thumbnail
- Title
- Ngày public
- Lượt xem (View)
- Số audio track và danh sách các audio track (ngôn ngữ lồng tiếng) của từng video
- Cảnh báo video thiếu ngôn ngữ so với một preset ngôn ngữ cần có

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
2. Dán link kênh vào ô ở hàng **Quét**. Các dạng link đều được:
   - `https://www.youtube.com/@TenKenh`
   - `https://www.youtube.com/channel/UCxxxxxxxx`
   - `https://www.youtube.com/c/TenKenh`, `https://www.youtube.com/user/TenKenh`
   - hoặc chỉ `@TenKenh`

   Muốn quét **một video** thì dán link video (`https://www.youtube.com/watch?v=...`, `https://youtu.be/...`, `https://www.youtube.com/shorts/...`). Khi đó ô **Số video** và **Sắp xếp** không có tác dụng.
3. Ô **Số video** (chữ mờ "Tất cả video"): để trống để lấy tất cả video, hoặc nhập N để chỉ lấy N video đầu tiên theo thứ tự sắp xếp.
4. Ô **Sắp xếp**: **Mới nhất**, **Phổ biến** (nhiều view nhất) hoặc **Cũ nhất**, giống bộ lọc ở tab Videos của kênh.
5. Bấm **Bắt đầu**. Bấm **Dừng** nếu muốn dừng giữa chừng.

### Link đã lưu

- Mỗi link đã quét được lưu ở hàng **Đã lưu**: link kênh hiện avatar và tên kênh, link video hiện thumbnail và title.
- Bấm vào một link để điền lại vào ô quét. Nếu là link kênh đã có preset, preset của kênh đó được chọn luôn; kênh chưa có preset thì chuyển về **Không dùng**.
- Bấm **×** để xoá link khỏi danh sách.

### Preset ngôn ngữ cần có

Preset là danh sách ngôn ngữ mà mỗi video phải có. Khi chọn một preset, video thiếu ngôn ngữ nào sẽ được tô vàng, ngôn ngữ thiếu hiện thành **khối đỏ nhấp nháy** (xếp A→Z cùng các track), và phía trên bảng ghi số video bị thiếu.

- **Chọn preset**: bấm tên preset ở hàng **Preset**. Bấm **Không dùng** để tắt cảnh báo.
- **Tạo từ một video chuẩn** (nên dùng): bấm nút **Lưu thành mẫu** ở cuối hàng của video đó. Preset lấy đúng các ngôn ngữ của video. Đang quét kênh thì preset mang tên kênh và gắn với kênh đó; nếu đã có preset trùng tên, extension hỏi trước khi thay.
- **Tạo bằng tay**: bấm **+ Tạo preset**, gõ tên rồi Enter.
- **Thêm/bớt ngôn ngữ** ở hàng **Cần có**: gõ tên ngôn ngữ (tiếng Anh hoặc tiếng Việt, vd `French` hay `Tiếng Pháp`) rồi Enter, hoặc chọn trong danh sách gợi ý. Bấm **×** trên khối để bỏ. Mỗi ngôn ngữ đều có thêm bản **mô tả** (descriptive).
- **Đổi tên / Xoá preset**: nút ở cuối hàng **Cần có**.

So khớp theo **mã ngôn ngữ** YouTube gắn cho từng track (vd `en-US`, `pt-BR`), nên:

- Giao diện YouTube tiếng Việt hay tiếng Anh đều so khớp đúng. Tên trong preset hiển thị theo cùng ngôn ngữ với bảng kết quả.
- So khớp chính xác: `English (US)` khác `English`, `Portuguese (Brazil)` khác `Portuguese (Portugal)`, bản mô tả khác bản thường. Vì vậy nên tạo preset bằng **Lưu thành mẫu** để lấy đúng mã YouTube dùng.

### Kênh nhiều video

- Bảng chia trang, mỗi trang 50 video, chuyển trang bằng **‹ Trước** / **Sau ›**.
- Việc quét chạy liên tục ở nền. Chuyển sang trang nào thì các video trên trang đó được ưu tiên quét trước.

### Đọc kết quả

Avatar và tên kênh hiện phía trên bảng, kèm tiến độ quét.

| Cột | Ý nghĩa |
|---|---|
| Thumbnail | Ảnh thu nhỏ của video, hiện khi video đã quét xong. |
| Số track | Số audio track của video. **0** = video chỉ có âm thanh gốc, kênh chưa thêm track lồng tiếng. |
| Audio tracks | Các ngôn ngữ, xếp A→Z. Ngôn ngữ **in đậm** là track gốc của video. |

Dòng ghi **Lỗi** (chữ đỏ) là video tải không được, chưa xác định được audio track. Có thể quét lại sau.

## Lưu ý

- Chỉ lấy video ở tab **Videos** của kênh, không gồm Shorts và Live.
- Nếu kênh chặn IP Việt Nam thì bật VPN trước khi quét.
- Quét kênh rất lớn liên tục có thể bị YouTube giới hạn tạm thời (lỗi 429). Đợi một lúc rồi chạy lại.
- Tên ngôn ngữ hiển thị theo ngôn ngữ giao diện YouTube của tài khoản bạn.
- Kết quả quét chỉ nằm trong tab đang mở, đóng tab là mất. Link đã lưu và preset thì được giữ lại trong Chrome trên máy này (gỡ extension là mất).

## Cập nhật bản mới

1. Tải lại code (Download ZIP mới, hoặc `git pull` trong thư mục đã clone).
2. Vào `chrome://extensions`, bấm nút ↻ (Reload) ở thẻ YouTube Audio Tracks.
