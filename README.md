# Neon Midnight: bản chạy bằng link, không cần tài khoản Claude

Gồm 3 phần: `public/index.html` (game), `worker.js` (máy chủ presence cho khán giả thật), `wrangler.toml` (cấu hình).
Game và máy chủ cùng nằm trên một địa chỉ, nên người xem chỉ cần mở một link.

## Triển khai (làm một lần, khoảng 10 phút)
1. Tạo tài khoản Cloudflare miễn phí tại dash.cloudflare.com.
2. Cài Node.js 18 trở lên trên máy của bạn.
3. Giải nén thư mục này, mở terminal trong đó, rồi chạy:
   ```
   npx wrangler login
   npx wrangler deploy
   ```
4. Lệnh cuối in ra link dạng `https://neon-midnight.<tên-của-bạn>.workers.dev`. Gửi link đó cho người xem.

## Chỉnh số người tối đa
Sửa `MAX_PER_ROOM` trong `wrangler.toml` (mặc định 100), rồi chạy lại `npx wrangler deploy`.
Phòng đầy thì người mới vẫn xem được show cùng khán giả ảo nhưng không có chỗ đứng.
Nên giữ không quá khoảng 120, vì game chỉ vẽ tối đa 115 chỗ đứng cho khán giả thật.

## Kiểm tra nhanh
- Mở `<link>/stats` để xem số người đang online và giới hạn.
- Chạy thử ở máy: `npx wrangler dev`, rồi mở http://localhost:8787 trên hai cửa sổ.

## Lưu ý
- Gói miễn phí của Cloudflare có hạn mức yêu cầu mỗi ngày. Hãy xem bảng giá Durable Objects hiện hành trước khi mời đông người.
- Tên ban nhạc SOLAR DRIFT và LUNA VOLT là tên tạm. Cần tra cứu nhãn hiệu trước khi công khai rộng.
- Mỗi tin nhắn máy chủ nhận đều được kiểm tra: tên tối đa 20 ký tự, đồ hợp lệ, emote nằm trong danh sách, tối đa 8 tin mỗi giây mỗi người.

## Nhạc trong concert (thử nghiệm)
Nhạc thử nghiệm: ba bản nhạc Việt từ Pixabay (giấy phép Pixabay Content License) gồm Upbeat Vietnam Festival Day, Năm tháng bên nhau, Vietnamese Festival Vibe. Hai bài CC0 của iamoneabe (Black Sheep, Mister Blues) vẫn nằm trong KV. Tệp mp3 nằm trong Cloudflare KV, phát qua đường `/audio/<tên>.mp3`. Lịch diễn do `agent/event_agent.py` dựng từ `agent/brief.json`.
