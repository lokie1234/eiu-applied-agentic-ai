# Thiết lập lưu Quiz + Showcase bằng Google Sheet

Giải pháp này dùng **một Google Sheet** để lưu kết quả Quiz và các link Web App được chia sẻ. Apps Script đồng thời gửi email kết quả Quiz về `son.lam@eiu.edu.vn`.

## 1. Tạo Apps Script

1. Tạo một Google Sheet mới, ví dụ `EIU Applied Agentic AI Data`.
2. Vào **Extensions → Apps Script**.
3. Xóa code mẫu và dán toàn bộ đoạn code dưới đây.
4. Nếu dùng secret, thay `CHANGE_ME` bằng một chuỗi riêng. Nếu không muốn dùng secret, để trống `""`.

```javascript
const RECIPIENT = "son.lam@eiu.edu.vn";
const WEBHOOK_SECRET = "CHANGE_ME";

function output(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function allowed(secret) {
  return !WEBHOOK_SECRET || String(secret || "") === WEBHOOK_SECRET;
}

function safeCell(value) {
  const text = String(value || "").trim();
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function sheet(name, headers) {
  const file = SpreadsheetApp.getActiveSpreadsheet();
  const tab = file.getSheetByName(name) || file.insertSheet(name);
  if (tab.getLastRow() === 0) tab.appendRow(headers);
  return tab;
}

function doGet(e) {
  try {
    if (!allowed(e.parameter.secret)) return output({ success: false, message: "Unauthorized" });
    if (e.parameter.action !== "showcase.list") return output({ success: false, message: "Unknown action" });
    const tab = sheet("Showcase", ["ID", "Shared At", "Name", "URL"]);
    const rows = tab.getLastRow() < 2 ? [] : tab.getRange(2, 1, tab.getLastRow() - 1, 4).getValues();
    const items = rows.slice(-50).reverse().map(row => ({
      id: String(row[0]),
      sharedAt: new Date(row[1]).toISOString(),
      name: String(row[2]),
      url: String(row[3])
    }));
    return output({ success: true, items });
  } catch (error) {
    return output({ success: false, message: String(error) });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || "{}");
    if (!allowed(data.secret)) return output({ success: false, message: "Unauthorized" });

    if (data.action === "showcase.submit") {
      const tab = sheet("Showcase", ["ID", "Shared At", "Name", "URL"]);
      const item = {
        id: Utilities.getUuid(),
        sharedAt: new Date().toISOString(),
        name: String(data.name || "").trim(),
        url: String(data.url || "").trim()
      };
      tab.appendRow([item.id, item.sharedAt, safeCell(item.name), item.url]);
      return output({ success: true, item });
    }

    if (data.action === "quiz.submit") {
      const tab = sheet("Quiz Results", ["Completed At", "Name", "Email", "Score", "Total", "Answers"]);
      const completedAt = String(data.completedAt || new Date().toISOString());
      tab.appendRow([completedAt, safeCell(data.name), safeCell(data.email), data.score, data.total, JSON.stringify(data.answers || [])]);
      const safeName = String(data.name || "").replace(/[<>&]/g, "");
      const safeEmail = String(data.email || "").replace(/[<>&]/g, "");
      MailApp.sendEmail({
        to: RECIPIENT,
        subject: `[EIU Quiz] ${safeName} — ${data.score}/${data.total}`,
        htmlBody: `<h2>Kết quả Applied Agentic AI</h2><p><b>Họ tên:</b> ${safeName}</p><p><b>Email:</b> ${safeEmail}</p><p><b>Điểm:</b> ${data.score}/${data.total}</p><p><b>Thời gian:</b> ${completedAt}</p>`
      });
      return output({ success: true });
    }

    return output({ success: false, message: "Unknown action" });
  } catch (error) {
    return output({ success: false, message: String(error) });
  }
}
```

## 2. Deploy và nối với Vercel

1. Trong Apps Script chọn **Deploy → New deployment → Web app**.
2. Chọn **Execute as: Me** và **Who has access: Anyone**.
3. Authorize, deploy, rồi copy URL kết thúc bằng `/exec`.
4. Trong Vercel → Project → **Settings → Environment Variables**, thêm:
   - `GOOGLE_APPS_SCRIPT_URL`: URL `/exec` vừa copy.
   - `GOOGLE_APPS_SCRIPT_SECRET`: đúng chuỗi đã đặt trong `WEBHOOK_SECRET`. Nếu Apps Script để trống thì biến này cũng để trống/không cần tạo.
5. Redeploy project trên Vercel.

Khi sửa code Apps Script sau này, vào **Deploy → Manage deployments → Edit → New version → Deploy**.
