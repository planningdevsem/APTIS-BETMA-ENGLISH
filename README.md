# BETMA ENGLISH — APTIS Practice & Mock Test

Bộ website tĩnh để publish bằng GitHub Pages, có tích hợp Google Apps Script làm đầu nhận dữ liệu và Google Sheets làm nơi lưu kết quả tập trung.

## 1. Cấu trúc thư mục

```text
index.html
js/
  bank.js
  config.js
assets/
  audio/
  img/
google-apps-script/
  Code.gs
.nojekyll
.gitignore
```

## 2. Dữ liệu được lưu

Google Apps Script tự tạo 6 sheet khi chạy `setupSheets()` hoặc nhận dữ liệu đầu tiên:

| Sheet | Nội dung |
|---|---|
| `STUDENT` | Candidate ID, họ tên, email, số điện thoại |
| `LEADS` | Đăng ký tư vấn từ trang chủ |
| `PRACTICE_HISTORY` | Mỗi lượt luyện tập là một dòng mới |
| `MOCK_TEST_RESULT` | Mỗi lượt thi thử là một dòng mới |
| `ANSWER_DETAIL` | Câu trả lời và đáp án theo từng câu |
| `WRITING_SPEAKING` | Bài Writing/Speaking và trạng thái chờ chấm |

**Không ghi đè lịch sử:** các lượt nộp dùng `Submission_ID` riêng. Google Apps Script dùng `LockService` để tuần tự hóa các lượt ghi đồng thời, kiểm tra ID trước khi thêm và chỉ dùng thao tác append. Nếu cùng một lượt được gửi lại do mạng chập chờn, backend nhận diện ID để tránh tạo thêm bản ghi. Chi tiết câu trả lời cũng được kiểm tra theo từng câu để hỗ trợ khôi phục khi gửi lại.

## 3. Cấu hình Google Sheets

1. Tạo một Google Spreadsheet mới.
2. Sao chép ID trong URL, ví dụ `https://docs.google.com/spreadsheets/d/ID_CUA_BAN/edit`.
3. Mở **Extensions → Apps Script**.
4. Mở file `google-apps-script/Code.gs` trong bộ source, sao chép toàn bộ vào `Code.gs` của Apps Script.
5. Thay `PASTE_GOOGLE_SPREADSHEET_ID_HERE` bằng ID Spreadsheet.
6. Chọn hàm `setupSheets` rồi bấm **Run**. Cấp quyền truy cập Spreadsheet khi Google yêu cầu.
7. Chọn **Deploy → New deployment → Web app**.
8. Chọn **Execute as: Me**. Chọn quyền truy cập **Anyone** để website GitHub Pages có thể gửi dữ liệu.
9. Bấm **Deploy**, sao chép URL Web App kết thúc bằng `/exec`.
10. Mở `js/config.js`, dán URL vào `appsScriptUrl`:

```js
window.BETMA_CONFIG = {
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbxWezEFA9ErPhS-y1vRMtl5MGwOZuTOUtwpwBqXUEea4cPhULX27ezf8JqudTvKNXAM/exec'
};
```

11. Lưu file và upload lại toàn bộ thư mục lên GitHub.

> Nếu sửa `Code.gs` sau khi deploy, vào **Deploy → Manage deployments → Edit → New version → Deploy** để cập nhật Web App.

## 4. Publish GitHub Pages

1. Tạo repository GitHub.
2. Upload **toàn bộ nội dung bên trong thư mục `betma-english`**, không upload thư mục cha `betma-english` lồng thêm một cấp.
3. Đảm bảo `index.html` nằm ngay ở root repository.
4. Vào **Settings → Pages**.
5. Chọn **Deploy from a branch**, Branch `main`, Folder `/ (root)`, bấm Save.
6. Mở URL GitHub Pages được cấp.

## 5. Luồng sử dụng

- **Luyện APTIS:** học viên phải nhập Candidate ID/Email và họ tên trước khi luyện. Mỗi lần bấm Kiểm tra sẽ tạo một bản ghi mới.
- **Thi thử:** học viên nhập Candidate ID/Email và họ tên. Khi nộp bài, hệ thống gửi kết quả tổng, câu trả lời chi tiết và nội dung Writing lên Google Sheets.
- **Đăng ký tư vấn:** dữ liệu được gửi vào sheet `LEADS`.
- **Mất mạng / lỗi tạm thời:** dữ liệu gửi được xếp vào `sheets_outbox` trong localStorage và tự thử gửi lại khi có kết nối. Trên đầu trang có trạng thái đồng bộ. Nếu trạng thái báo chưa xác nhận, không xóa dữ liệu trình duyệt; hãy kết nối lại mạng và tải lại trang để thử đồng bộ.

## 6. Kiểm thử trước khi dùng thật

1. Dùng học viên A làm một bài luyện tập; xác nhận một dòng mới xuất hiện ở `PRACTICE_HISTORY` và các câu ở `ANSWER_DETAIL`.
2. Làm lại cùng bài; phải có `Submission_ID` mới và thêm dòng mới.
3. Dùng học viên B ở trình duyệt khác; xác nhận dữ liệu vào cùng Spreadsheet nhưng có `Student_ID` riêng.
4. Nộp một bài thi thử; kiểm tra `MOCK_TEST_RESULT`, `ANSWER_DETAIL` và `WRITING_SPEAKING`.
5. Gửi lại cùng một Submission_ID để xác nhận backend không tạo bản ghi trùng.
6. Thử hai thiết bị nộp gần như cùng lúc.

## 7. Giới hạn và bảo mật cần biết

- Bản gốc sử dụng đăng nhập demo. Phiên bản này thu Candidate ID/Email và họ tên để gắn kết quả, **không xác thực mật khẩu và không chứng minh danh tính**. Người dùng có thể tự nhập thông tin của người khác. Muốn vận hành có bảo mật cần bổ sung hệ thống tài khoản/backend có xác thực thật.
- Apps Script Web App được cấu hình công khai để nhận dữ liệu từ GitHub Pages. Không lưu thông tin nhạy cảm hoặc mật khẩu trong payload. Hạn chế quyền chia sẻ Google Spreadsheet chỉ cho nhân sự được phép.
- Kết quả Writing được lưu để giáo viên chấm sau. Bản thi hiện tại không bật Speaking trong đề `APTIS-PT-V1`; nếu bật lại Speaking, mã hiện tại mới gửi trạng thái/metadata ghi âm, chưa tải file âm thanh ghi âm lên Drive.
- Hàng đợi offline lưu trên trình duyệt của thiết bị đang làm bài. Không xóa dữ liệu trang web/trình duyệt khi còn lượt đang chờ đồng bộ.
- Không có hệ thống nào bảo đảm tuyệt đối nếu người dùng đóng/xóa dữ liệu trình duyệt trước khi hàng đợi được gửi thành công. Cần kiểm thử thực tế với tài khoản Google và deployment của bạn trước khi công bố rộng rãi.

## 8. Tài liệu và bản quyền

Giữ nguyên ngân hàng câu hỏi, audio, hình ảnh và nội dung có sẵn trong source được bàn giao. Trước khi đặt repository ở chế độ public, hãy xác nhận quyền phát hành đối với các tài liệu bên thứ ba, đặc biệt nội dung Aptis General Practice Tests được README bản gốc ghi nhận © British Council 2020.
