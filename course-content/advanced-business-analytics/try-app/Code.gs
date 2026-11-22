/***************************************************************
 * APPLIED AGENTIC AI FOR BUSINESS — EIU
 * Google Apps Script backend
 ***************************************************************/

const SPREADSHEET_ID =
  '1v8wNscdcd7R9DuBTj8R4gaz7UGLFEvywHiqVVREkL84';

const SHEET_GID = 0;

const STANDARD_TUITION = 1000000;
const EIU_TUITION = 500000;

/*
 * Logo EIU lưu trong Google Drive.
 * Ảnh được đọc ở phía máy chủ, chuyển thành Base64 rồi nhúng
 * trực tiếp vào HTML. Nhờ vậy điện thoại không phải truy cập
 * đường dẫn thumbnail của Google Drive.
 */
const LOGO_FILE_ID =
  '1bB64zU-zAoyRJFPn4ZpyASYQFAkJdruh';

const LOGO_CACHE_KEY =
  'EIU_LOGO_DATA_URL_V1';


const REGISTRATION_HEADERS = [
  'Thời gian đăng ký',
  'Họ và tên',
  'Số điện thoại',
  'Email',
  'Trạng thái',
  'Đối tượng',
  'Học phí',
  'Khóa đăng ký',
  'Email xác nhận'
];

const DEMO_APPS = {
  leave: {
    title: 'Quản lý nghỉ phép',
    subtitle:
      'Theo dõi đơn nghỉ, trạng thái phê duyệt và số ngày phép còn lại.'
  },

  time: {
    title: 'Quản lý thời gian làm việc',
    subtitle:
      'Ghi nhận thời gian làm việc, tiến độ và hiệu suất theo ngày.'
  },

  meeting: {
    title: 'Quản lý cuộc họp',
    subtitle:
      'Sắp xếp lịch họp, người tham dự và các nội dung cần theo dõi.'
  },

  overtime: {
    title: 'Quản lý tăng ca',
    subtitle:
      'Theo dõi số giờ tăng ca, trạng thái phê duyệt và báo cáo theo kỳ.'
  }
};


/**
 * Hiển thị trang chủ, đăng ký hoặc trang demo.
 */
function doGet(e) {
  const params =
    e && e.parameter
      ? e.parameter
      : {};

  const requestedPage =
    String(params.page || '')
      .toLowerCase();

  let page = 'Index';

  if (requestedPage === 'register') {
    page = 'Register';

  } else if (requestedPage === 'demo') {
    page = 'Demo';
  }

  const template =
    HtmlService.createTemplateFromFile(page);

  template.appUrl =
    ScriptApp.getService().getUrl() || '';

  template.logoUrl =
    getLogoDataUrl_();

  let title =
    'Applied Agentic AI for Business';

  if (page === 'Register') {
    title =
      'Đăng ký khóa học Applied Agentic AI';
  }

  if (page === 'Demo') {
    const requestedType =
      String(params.type || 'leave')
        .toLowerCase();

    const demoType =
      Object.prototype.hasOwnProperty.call(
        DEMO_APPS,
        requestedType
      )
        ? requestedType
        : 'leave';

    template.demoType =
      demoType;

    template.demo =
      DEMO_APPS[demoType];

    title =
      DEMO_APPS[demoType].title +
      ' · Demo Web App EIU';
  }

  return template
    .evaluate()
    .setTitle(title)
    .addMetaTag(
      'viewport',
      'width=device-width, initial-scale=1, viewport-fit=cover'
    )
    .setXFrameOptionsMode(
      HtmlService.XFrameOptionsMode.ALLOWALL
    );
}


/**
 * Chạy thủ công một lần để chuẩn hóa Sheet.
 */
function setupRegistrationSheet() {
  const sheet =
    getRegistrationSheet_();

  ensureSheetReady_(sheet);

  SpreadsheetApp.flush();

  return 'Đã chuẩn hóa Sheet đăng ký.';
}


/**
 * Nhận, kiểm tra và lưu thông tin đăng ký.
 */
function saveRegistration(formData) {
  if (
    !formData ||
    typeof formData !== 'object'
  ) {
    throw new Error(
      'Thông tin đăng ký không hợp lệ.'
    );
  }

  /*
   * Trường ẩn chống bot.
   */
  if (normalizeText_(formData.website)) {
    throw new Error(
      'Không thể xử lý yêu cầu này.'
    );
  }

  const fullName =
    normalizeText_(formData.fullName);

  const email =
    normalizeText_(formData.email)
      .toLowerCase();

  const nameKey =
    normalizeNameKey_(fullName);

  const normalizedPhone =
    normalizeVietnamPhone_(
      formData.phone
    );

  validateRegistration_(
    fullName,
    nameKey,
    normalizedPhone,
    email
  );

  const isEiuStudent =
    isEiuEmail_(email);

  const tuition =
    isEiuStudent
      ? EIU_TUITION
      : STANDARD_TUITION;

  const registrationKey =
    createRegistrationKey_(
      nameKey,
      normalizedPhone
    );

  /*
   * Ngăn hai lượt đăng ký ghi đồng thời.
   */
  const lock =
    LockService.getScriptLock();

  if (!lock.tryLock(8000)) {
    return {
      success: false,
      busy: true,
      message:
        'Hệ thống đang tiếp nhận nhiều lượt đăng ký. ' +
        'Vui lòng chờ vài giây rồi thử lại.'
    };
  }

  let sheet;
  let nextRow;

  try {
    sheet =
      getRegistrationSheet_();

    ensureSheetReady_(sheet);

    if (
      registrationExists_(
        sheet,
        registrationKey
      )
    ) {
      return {
        success: false,
        duplicate: true,
        message:
          'Họ tên và số điện thoại này đã được đăng ký trước đó. ' +
          'Bạn không cần gửi lại biểu mẫu.'
      };
    }

    nextRow =
      Math.max(
        sheet.getLastRow() + 1,
        2
      );

    const registrationRow = [
      new Date(),

      safeSheetText_(
        fullName
      ),

      safeSheetText_(
        normalizedPhone
      ),

      safeSheetText_(
        email
      ),

      'Mới',

      isEiuStudent
        ? 'Sinh viên EIU'
        : 'Học viên ngoài EIU',

      tuition,

      registrationKey,

      'Đang gửi'
    ];

    sheet
      .getRange(
        nextRow,
        1,
        1,
        registrationRow.length
      )
      .setValues([
        registrationRow
      ]);

    SpreadsheetApp.flush();

  } finally {
    lock.releaseLock();
  }

  /*
   * Gửi email sau khi đã lưu dữ liệu.
   *
   * Nếu gửi email lỗi, thông tin đăng ký
   * vẫn được giữ trong Google Sheets.
   */
  let emailSent = false;
  let emailStatus = 'Chưa gửi';

  try {
    if (
      MailApp.getRemainingDailyQuota() < 1
    ) {
      throw new Error(
        'Tài khoản gửi thư đã hết hạn mức email trong ngày.'
      );
    }

    sendRegistrationConfirmation_(
      email,
      fullName,
      isEiuStudent,
      tuition
    );

    emailSent = true;
    emailStatus = 'Đã gửi';

  } catch (emailError) {
    emailStatus =
      'Lỗi: ' +
      String(
        emailError &&
        emailError.message
          ? emailError.message
          : emailError
      ).slice(0, 180);

    console.error(
      'Không gửi được email xác nhận: ' +
      emailStatus
    );
  }

  /*
   * Ghi lại trạng thái email tại cột I.
   */
  try {
    sheet
      .getRange(
        nextRow,
        9
      )
      .setValue(
        emailStatus
      );

  } catch (statusError) {
    console.error(
      'Không cập nhật được trạng thái email: ' +
      statusError.message
    );
  }

  return {
    success: true,

    emailSent:
      emailSent,

    isEiu:
      isEiuStudent,

    tuition:
      tuition,

    formattedTuition:
      formatCurrency_(tuition),

    message:
      emailSent
        ? 'Đăng ký thành công. Email xác nhận đã được gửi đến ' +
          email +
          '.'
        : 'Đăng ký thành công. Thông tin của bạn đã được ghi nhận; ' +
          'Ban tổ chức sẽ liên hệ lại với bạn.'
  };
}


/**
 * Lấy Sheet lưu đăng ký.
 */
function getRegistrationSheet_() {
  const spreadsheet =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );

  const sheet =
    spreadsheet.getSheetById(
      SHEET_GID
    ) ||
    spreadsheet.getSheets()[0];

  if (!sheet) {
    throw new Error(
      'Không tìm thấy trang tính lưu đăng ký.'
    );
  }

  return sheet;
}


/**
 * Chuẩn hóa cấu trúc Sheet
 * và tạo khóa cho dữ liệu cũ.
 */
function ensureSheetReady_(sheet) {
  const existingHeaders =
    sheet
      .getRange(
        1,
        1,
        1,
        REGISTRATION_HEADERS.length
      )
      .getDisplayValues()[0];

  const needsSetup =
    REGISTRATION_HEADERS.some(
      function (header, index) {
        return (
          existingHeaders[index] !==
          header
        );
      }
    );

  if (!needsSetup) {
    return;
  }

  sheet
    .getRange(
      1,
      1,
      1,
      REGISTRATION_HEADERS.length
    )
    .setValues([
      REGISTRATION_HEADERS
    ])
    .setFontWeight('bold')
    .setFontColor('#ffffff')
    .setBackground('#123f68')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 36);

  const widths = [
    175,
    220,
    150,
    245,
    105,
    160,
    135,
    280,
    180
  ];

  widths.forEach(
    function (width, index) {
      sheet.setColumnWidth(
        index + 1,
        width
      );
    }
  );

  sheet
    .getRange('A:A')
    .setNumberFormat(
      'dd/MM/yyyy HH:mm:ss'
    );

  sheet
    .getRange('B:D')
    .setNumberFormat('@');

  sheet
    .getRange('G:G')
    .setNumberFormat(
      '#,##0" đồng"'
    );

  backfillRegistrationKeys_(
    sheet
  );

  /*
   * Cột H là khóa nội bộ.
   */
  try {
    sheet.hideColumns(8);

  } catch (error) {
    console.warn(
      'Không thể ẩn cột khóa đăng ký: ' +
      error.message
    );
  }
}


/**
 * Tạo khóa cho dữ liệu đăng ký cũ.
 */
function backfillRegistrationKeys_(sheet) {
  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2) {
    return;
  }

  const rowCount =
    lastRow - 1;

  const sourceData =
    sheet
      .getRange(
        2,
        2,
        rowCount,
        2
      )
      .getDisplayValues();

  const existingKeys =
    sheet
      .getRange(
        2,
        8,
        rowCount,
        1
      )
      .getDisplayValues();

  let hasChanges = false;

  const output =
    sourceData.map(
      function (row, index) {
        const currentKey =
          normalizeText_(
            existingKeys[index][0]
          );

        if (currentKey) {
          return [
            currentKey
          ];
        }

        const nameKey =
          normalizeNameKey_(
            row[0]
          );

        const phoneKey =
          normalizeVietnamPhone_(
            row[1]
          );

        if (
          !nameKey ||
          !phoneKey
        ) {
          return [''];
        }

        hasChanges = true;

        return [
          createRegistrationKey_(
            nameKey,
            phoneKey
          )
        ];
      }
    );

  if (hasChanges) {
    sheet
      .getRange(
        2,
        8,
        output.length,
        1
      )
      .setValues(
        output
      );
  }
}


/**
 * Kiểm tra khóa trùng trong cột H.
 */
function registrationExists_(
  sheet,
  registrationKey
) {
  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2) {
    return false;
  }

  const found =
    sheet
      .getRange(
        2,
        8,
        lastRow - 1,
        1
      )
      .createTextFinder(
        registrationKey
      )
      .matchEntireCell(true)
      .useRegularExpression(false)
      .findNext();

  return Boolean(found);
}


/**
 * Kiểm tra dữ liệu phía máy chủ.
 */
function validateRegistration_(
  fullName,
  nameKey,
  phone,
  email
) {
  if (
    fullName.length < 2 ||
    fullName.length > 100 ||
    nameKey.length < 2
  ) {
    throw new Error(
      'Vui lòng nhập họ và tên hợp lệ.'
    );
  }

  if (
    !isValidVietnamMobile_(phone)
  ) {
    throw new Error(
      'Số điện thoại phải là số di động Việt Nam gồm 10 chữ số, ' +
      'bắt đầu bằng 03, 05, 07, 08 hoặc 09.'
    );
  }

  if (
    email.length < 5 ||
    email.length > 150 ||
    !isValidEmail_(email)
  ) {
    throw new Error(
      'Vui lòng nhập địa chỉ email hợp lệ.'
    );
  }
}


/**
 * Kiểm tra số di động Việt Nam.
 */
function isValidVietnamMobile_(phone) {
  return /^0(?:3|5|7|8|9)\d{8}$/
    .test(phone);
}


/**
 * Chuẩn hóa:
 *
 * +84 901 234 567
 * 84 901 234 567
 *
 * thành:
 *
 * 0901234567
 */
function normalizeVietnamPhone_(value) {
  let digits =
    String(value || '')
      .replace(/\D/g, '');

  if (
    digits.indexOf('84') === 0 &&
    digits.length === 11
  ) {
    digits =
      '0' +
      digits.substring(2);
  }

  return digits;
}


/**
 * Kiểm tra email.
 */
function isValidEmail_(email) {
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/
    .test(email);
}


/**
 * Kiểm tra email EIU.
 */
function isEiuEmail_(email) {
  return /@eiu\.edu\.vn$/i
    .test(email);
}


/**
 * Chuẩn hóa khoảng trắng.
 */
function normalizeText_(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}


/**
 * Chuẩn hóa tên để kiểm tra trùng.
 */
function normalizeNameKey_(value) {
  let text =
    normalizeText_(value)
      .toLowerCase();

  try {
    text =
      text
        .normalize('NFD')
        .replace(
          /[\u0300-\u036f]/g,
          ''
        );

  } catch (error) {
    /*
     * Giữ nguyên nếu môi trường
     * không hỗ trợ normalize().
     */
  }

  return text
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}


/**
 * Tạo khóa kiểm tra trùng.
 */
function createRegistrationKey_(
  nameKey,
  phone
) {
  return (
    nameKey +
    '|' +
    phone
  );
}


/**
 * Ngăn dữ liệu người dùng
 * trở thành công thức trong Sheet.
 */
function safeSheetText_(value) {
  const text =
    String(value || '');

  return /^[=+\-@]/.test(text)
    ? "'" + text
    : text;
}


/**
 * Định dạng học phí.
 */
function formatCurrency_(amount) {
  return (
    Number(amount || 0)
      .toLocaleString('vi-VN') +
    ' đồng'
  );
}


/**
 * Đọc logo từ Drive,
 * chuyển thành Data URL
 * và lưu cache 6 giờ.
 */
function getLogoDataUrl_() {
  const cache =
    CacheService.getScriptCache();

  const cachedLogo =
    cache.get(
      LOGO_CACHE_KEY
    );

  if (cachedLogo) {
    return cachedLogo;
  }

  try {
    const blob =
      DriveApp
        .getFileById(
          LOGO_FILE_ID
        )
        .getBlob();

    const contentType =
      blob.getContentType() ||
      'image/png';

    const dataUrl =
      'data:' +
      contentType +
      ';base64,' +
      Utilities.base64Encode(
        blob.getBytes()
      );

    try {
      cache.put(
        LOGO_CACHE_KEY,
        dataUrl,
        21600
      );

    } catch (cacheError) {
      console.warn(
        'Không thể cache logo: ' +
        cacheError.message
      );
    }

    return dataUrl;

  } catch (error) {
    console.error(
      'Không đọc được logo EIU: ' +
      error.message
    );

    /*
     * Đường dẫn dự phòng.
     */
    return (
      'https://drive.google.com/uc?export=view&id=' +
      encodeURIComponent(
        LOGO_FILE_ID
      )
    );
  }
}


/**
 * Chạy thủ công nếu vừa thay logo
 * nhưng vẫn thấy ảnh cũ.
 */
function clearLogoCache() {
  CacheService
    .getScriptCache()
    .remove(
      LOGO_CACHE_KEY
    );

  return 'Đã xóa bộ nhớ đệm logo.';
}


/**
 * Gửi email xác nhận đăng ký.
 */
function sendRegistrationConfirmation_(
  recipientEmail,
  fullName,
  isEiuStudent,
  tuition
) {
  const safeName =
    escapeHtml_(fullName);

  const formattedTuition =
    formatCurrency_(tuition);

  const subject =
    'Xác nhận đăng ký Khóa học Agentic AI tại EIU';

  const plainText = [
    'Chào ' + fullName + ',',
    '',
    'Bạn đã hoàn tất đăng ký Khóa học Applied Agentic AI for Business tại EIU.',
    '',
    'Mức phí tham dự: ' + formattedTuition + '.',
    '',
    'Lịch trình và hướng dẫn tham dự sẽ được Ban tổ chức gửi đến email này trong thời gian tới.',
    '',
    'Cảm ơn bạn đã đăng ký. Hẹn gặp bạn tại khóa học!',
    '',
    'Trân trọng,',
    'Ban tổ chức Khóa học Agentic AI',
    'Eastern International University'
  ].join('\n');

  const discountBlock =
    isEiuStudent
      ? `
        <div style="
          margin:20px 0;
          padding:14px 16px;
          border:1px solid #ecd49c;
          border-radius:12px;
          background:#fff7e4;
          color:#71500f;
          font-weight:700;
        ">
          🎉 Email EIU đã được xác nhận.<br>
          Bạn được áp dụng ưu đãi 50%:
          <strong>${formattedTuition}</strong>.
        </div>
      `
      : `
        <div style="
          margin:20px 0;
          padding:14px 16px;
          border:1px solid #dce4eb;
          border-radius:12px;
          background:#f7fafc;
          color:#17324a;
        ">
          Mức phí tham dự:
          <strong>${formattedTuition}</strong>.
        </div>
      `;

  const htmlBody = `
    <!DOCTYPE html>
    <html lang="vi">
      <body style="
        margin:0;
        padding:0;
        background:#f3f5f7;
        font-family:Arial,Helvetica,sans-serif;
        color:#17324a;
      ">

        <div style="
          max-width:620px;
          margin:0 auto;
          padding:28px 16px;
        ">

          <div style="
            overflow:hidden;
            border-radius:18px;
            background:#ffffff;
            box-shadow:
              0 12px 35px
              rgba(8,41,69,0.12);
          ">

            <div style="
              padding:28px;
              color:#ffffff;
              background:#082945;
            ">

              <div style="
                color:#f4dfb0;
                font-size:12px;
                font-weight:700;
                letter-spacing:1px;
                text-transform:uppercase;
              ">
                Eastern International University
              </div>

              <h1 style="
                margin:10px 0 0;
                font-size:25px;
                line-height:1.35;
              ">
                Đăng ký thành công
              </h1>

            </div>

            <div style="
              padding:28px;
              font-size:15px;
              line-height:1.7;
            ">

              <p style="margin:0 0 16px;">
                Chào
                <strong>${safeName}</strong>,
              </p>

              <p style="margin:0 0 16px;">
                Bạn đã hoàn tất đăng ký
                <strong>
                  Khóa học Applied Agentic AI for Business
                </strong>
                tại EIU.
              </p>

              ${discountBlock}

              <p style="margin:0 0 16px;">
                Lịch trình và hướng dẫn tham dự
                sẽ được Ban tổ chức gửi đến email này
                trong thời gian tới.
              </p>

              <p style="margin:0;">
                Cảm ơn bạn đã đăng ký.
                <strong>
                  Hẹn gặp bạn tại khóa học!
                </strong>
              </p>

            </div>

            <div style="
              padding:18px 28px;
              color:#6b7884;
              background:#f7f4ed;
              font-size:12px;
              line-height:1.6;
            ">
              Ban tổ chức Khóa học Agentic AI<br>
              Eastern International University
            </div>

          </div>

        </div>

      </body>
    </html>
  `;

  MailApp.sendEmail({
    to:
      recipientEmail,

    subject:
      subject,

    body:
      plainText,

    htmlBody:
      htmlBody,

    name:
      'EIU · Agentic AI'
  });
}


/**
 * Mã hóa dữ liệu trước khi
 * đưa vào nội dung email HTML.
 */
function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}