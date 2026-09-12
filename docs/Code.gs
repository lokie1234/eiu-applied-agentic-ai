const SPREADSHEET_ID = "1j44K3vgiSHrIjPA5l6vYtJ6LzIqzVQok3oLzpWwwGgQ";
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

function getSheet(name, headers) {
  const file = SpreadsheetApp.openById(SPREADSHEET_ID);
  const tab = file.getSheetByName(name) || file.insertSheet(name);
  if (tab.getLastRow() === 0) {
    tab.appendRow(headers);
    tab.setFrozenRows(1);
  }
  return tab;
}

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    if (!allowed(params.secret)) {
      return output({ success: false, message: "Không có quyền truy cập." });
    }
    if (params.action !== "showcase.list") {
      return output({ success: false, message: "Yêu cầu không hợp lệ." });
    }

    const tab = getSheet("Bài làm chia sẻ", ["Mã", "Thời gian", "Họ và tên", "Liên kết"]);
    const lastRow = tab.getLastRow();
    const rows = lastRow < 2 ? [] : tab.getRange(2, 1, lastRow - 1, 4).getDisplayValues();
    const items = rows.slice(-50).reverse().map(function (row) {
      return {
        id: String(row[0]),
        sharedAt: String(row[1]),
        name: String(row[2]),
        url: String(row[3])
      };
    });
    return output({ success: true, items: items });
  } catch (error) {
    return output({ success: false, message: String(error) });
  }
}

function doPost(e) {
  try {
    const raw = e && e.postData ? e.postData.contents : "{}";
    const data = JSON.parse(raw || "{}");
    if (!allowed(data.secret)) {
      return output({ success: false, message: "Không có quyền truy cập." });
    }

    if (data.action === "showcase.submit") {
      const name = String(data.name || "").trim();
      const url = String(data.url || "").trim();
      if (!name || !url) {
        return output({ success: false, message: "Thiếu họ tên hoặc liên kết." });
      }

      const item = {
        id: Utilities.getUuid(),
        sharedAt: new Date().toISOString(),
        name: name,
        url: url
      };
      const tab = getSheet("Bài làm chia sẻ", ["Mã", "Thời gian", "Họ và tên", "Liên kết"]);
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        tab.appendRow([item.id, item.sharedAt, safeCell(item.name), safeCell(item.url)]);
      } finally {
        lock.releaseLock();
      }
      return output({ success: true, item: item });
    }

    if (data.action === "showcase.delete") {
      const id = String(data.id || "").trim();
      if (!id) {
        return output({ success: false, message: "Thiếu mã bài chia sẻ." });
      }

      const tab = getSheet("Bài làm chia sẻ", ["Mã", "Thời gian", "Họ và tên", "Liên kết"]);
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        const lastRow = tab.getLastRow();
        if (lastRow < 2) return output({ success: true });
        const cell = tab.getRange(2, 1, lastRow - 1, 1)
          .createTextFinder(id)
          .matchEntireCell(true)
          .findNext();
        if (cell) tab.deleteRow(cell.getRow());
      } finally {
        lock.releaseLock();
      }
      return output({ success: true });
    }

    if (data.action === "quiz.submit") {
      const name = String(data.name || "").trim();
      const score = Number(data.score);
      const total = Number(data.total);
      if (!name || !Number.isInteger(score) || total !== 10 || score < 0 || score > total) {
        return output({ success: false, message: "Kết quả không hợp lệ." });
      }

      const completedAt = String(data.completedAt || new Date().toISOString());
      const tab = getSheet("Kết quả bài kiểm tra", ["Thời gian", "Họ và tên", "Kết quả"]);
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        tab.appendRow([completedAt, safeCell(name), score + "/" + total]);
      } finally {
        lock.releaseLock();
      }
      return output({ success: true });
    }

    return output({ success: false, message: "Yêu cầu không hợp lệ." });
  } catch (error) {
    return output({ success: false, message: String(error) });
  }
}
