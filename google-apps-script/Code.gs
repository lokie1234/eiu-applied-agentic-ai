const OTP_SECRET_PROPERTY = "GAS_OTP_SHARED_SECRET";

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const email = String(payload.email || "").trim().toLowerCase();
    const otp = String(payload.otp || "").trim();
    const timestamp = String(payload.timestamp || "").trim();
    const nonce = String(payload.nonce || "").trim();
    const suppliedSignature = String(payload.signature || "").trim().toLowerCase();
    const secret = PropertiesService.getScriptProperties().getProperty(OTP_SECRET_PROPERTY);

    if (!secret) throw new Error("GAS_OTP_SHARED_SECRET is missing in Script Properties.");
    if (!/^[^@\s]+@eiu\.edu\.vn$/i.test(email)) throw new Error("Invalid EIU email.");
    if (!/^\d{6}$/.test(otp)) throw new Error("Invalid OTP format.");
    if (!nonce || nonce.length > 100) throw new Error("Invalid nonce.");

    const requestTime = Number(timestamp);
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(requestTime) || Math.abs(now - requestTime) > 300) {
      throw new Error("Expired request.");
    }

    const canonical = [email, otp, timestamp, nonce].join("\n");
    const expectedSignature = hmacHex_(canonical, secret);
    if (!safeEqual_(suppliedSignature, expectedSignature)) throw new Error("Invalid signature.");
    const nonceCache = CacheService.getScriptCache();
    if (nonceCache.get(nonce)) throw new Error("Request already processed.");
    nonceCache.put(nonce, "1", 600);
    if (MailApp.getRemainingDailyQuota() < 1) throw new Error("Mail quota exceeded.");

    MailApp.sendEmail({
      to: email,
      subject: otp + " là mã đăng nhập EIU Applied Agentic AI",
      name: "EIU Applied Agentic AI",
      htmlBody:
        '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px">' +
        '<h2 style="color:#082945">Mã đăng nhập Applied Agentic AI</h2>' +
        '<p style="color:#526779">Dùng mã OTP bên dưới để hoàn tất đăng nhập:</p>' +
        '<div style="margin:24px 0;padding:18px;border-radius:14px;background:#f7f4ed;' +
        'color:#082945;font-size:34px;font-weight:800;letter-spacing:9px;text-align:center">' +
        otp + '</div>' +
        '<p style="color:#7b8994;font-size:13px">Mã chỉ dùng một lần. Không chia sẻ mã này cho người khác.</p>' +
        '</div>',
    });

    return json_({ success: true });
  } catch (error) {
    console.error(error);
    return json_({ success: false, message: String(error && error.message || error) });
  }
}

function hmacHex_(value, secret) {
  const bytes = Utilities.computeHmacSha256Signature(value, secret, Utilities.Charset.UTF_8);
  return bytes.map(function(byte) {
    const normalized = byte < 0 ? byte + 256 : byte;
    return ("0" + normalized.toString(16)).slice(-2);
  }).join("");
}

function safeEqual_(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function json_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
