"use client";

import { useSyncExternalStore } from "react";

export type LearningLanguage = "vi" | "en";
// Deliberately separate from administrator settings and course content language.
export const LEARNING_LANGUAGE_KEY = "eiu.learning-interface-language";
const changeEvent = "eiu:learning-language";
let fallback: LearningLanguage = "en";

function snapshot(): LearningLanguage {
  try {
    const stored = window.localStorage.getItem(LEARNING_LANGUAGE_KEY);
    return stored === "vi" || stored === "en" ? stored : fallback;
  } catch { return fallback; }
}

function subscribe(notify: () => void) {
  window.addEventListener(changeEvent, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(changeEvent, notify);
    window.removeEventListener("storage", notify);
  };
}

const messages: Record<string, string> = {
  "Session controls": "Điều khiển phiên học",
  "Admin mode": "Chế độ quản trị",
  "Teaching mode": "Chế độ giảng dạy",
  "Learning session": "Phiên học",
  "Terminate Section": "Kết thúc học phần",
  "Try again": "Thử lại",
  "ADMIN ACTION": "THAO TÁC QUẢN TRỊ",
  "Terminate current section?": "Kết thúc học phần hiện tại?",
  "Learners in this section will return to the access screen.": "Học viên trong học phần này sẽ trở về màn hình đăng nhập.",
  "Terminating...": "Đang kết thúc...",
  "Terminate": "Kết thúc",
  "Opening lesson": "Đang mở bài học",
  "Unable to export the report.": "Không thể xuất báo cáo.",
  "Enter the confirmation passcode.": "Vui lòng nhập mã xác nhận.",
  "Load and choose a valid reset scope first.": "Vui lòng tải và chọn phạm vi xóa hợp lệ trước.",
  "The confirmation value is incorrect.": "Mã xác nhận không đúng.",
  "Unable to reset data.": "Không thể xóa dữ liệu.",
  "Failed to terminate section.": "Không thể kết thúc học phần.",
  "Unable to load reset scopes.": "Không thể tải phạm vi xóa dữ liệu.",
  "Unable to load current folder, course and section scopes. Reopen this dialog to retry.": "Không thể tải phạm vi thư mục, khóa học và học phần hiện tại. Mở lại hộp thoại để thử lại.",
  "Sign in": "Đăng nhập",
  "Sign in with passcode": "Đăng nhập bằng mã truy cập",
  "Sign in with Google": "Đăng nhập bằng Google",
  "Use your EIU administrator account.": "Dùng tài khoản quản trị viên EIU.",
  "Passcode": "Mã truy cập",
  "Learners & facilitators": "Học viên & giảng viên",
  "Administrator access": "Dành cho quản trị viên",
  "EIU administrator": "Quản trị viên EIU",
  "Google sign-in also connects Drive.": "Đăng nhập Google đồng thời kết nối Drive.",
  "Continue with Google": "Tiếp tục với Google",
  "Unable to sign in": "Không thể đăng nhập",
  "Back": "Quay lại",
  "Back to sign-in options": "Quay lại các cách đăng nhập",
  "Secure access": "Truy cập bảo mật",
  "Signing in…": "Đang đăng nhập…",
  "A little about you": "Thông tin của bạn",
  "Complete your information to enter the learning space.": "Hoàn tất thông tin để vào không gian học tập.",
  "Close learner information": "Đóng thông tin học viên",
  "Your details stay linked to your submissions, quizzes, and feedback.": "Thông tin của bạn được liên kết với bài nộp, bài kiểm tra và phản hồi.",
  "Cancel": "Hủy",
  "Continue": "Tiếp tục",
  "Close": "Đóng",
  "Name": "Họ và tên",
  "Functions": "Chức năng",
  "Course functions": "Chức năng khóa học",
  "Access settings": "Cài đặt truy cập",
  "AI Knowledge": "Kiến thức AI",
  "Report": "Báo cáo",
  "Exporting…": "Đang xuất…",
  "Reset data": "Xóa dữ liệu",
  "Sign out": "Đăng xuất",
  "ADMIN LEARNING SPACE": "KHÔNG GIAN QUẢN TRỊ",
  "MY LEARNING SPACE": "KHÔNG GIAN HỌC TẬP",
  "Search courses or topics...": "Tìm khóa học hoặc chủ đề...",
  "Search courses": "Tìm khóa học",
  "Clear search": "Xóa tìm kiếm",
  "Course folders": "Thư mục khóa học",
  "Folder navigation": "Điều hướng thư mục",
  "Folder pages": "Các trang thư mục",
  "Previous folder page": "Trang thư mục trước",
  "Next folder page": "Trang thư mục tiếp",
  "Course library": "Thư viện khóa học",
  "No courses found": "Không tìm thấy khóa học",
  "Courses": "Khóa học",
  "Back to courses": "Quay lại khóa học",
  "Content has not been uploaded yet": "Nội dung chưa được tải lên",
  "View file": "Xem tệp",
  "Download": "Tải xuống",
  "Download the original presentation": "Tải bản trình chiếu gốc",
  "This course does not have any sections yet.": "Khóa học này chưa có học phần.",
  "Vietnamese": "Tiếng Việt",
  "English": "Tiếng Anh",
  "Vietnamese · English": "Tiếng Việt · Tiếng Anh",
  "UNLOCKED": "ĐÃ MỞ KHÓA",
  "course": "khóa học",
  "courses": "khóa học",
  "COURSE": "KHÓA HỌC",
  "COURSES": "KHÓA HỌC",
  "SECTION": "HỌC PHẦN",
  "SECTIONS": "HỌC PHẦN",
  "‹ Prev": "‹ Trước",
  "Next ›": "Tiếp ›",
  "ANALYTICS REPORT": "BÁO CÁO PHÂN TÍCH",
  "Export Excel report": "Xuất báo cáo Excel",
  "Choose a folder, then a course and one or all of its sections.": "Chọn thư mục, khóa học và một hoặc tất cả học phần.",
  "Folder scope": "Phạm vi thư mục",
  "Course scope": "Phạm vi khóa học",
  "Section scope": "Phạm vi học phần",
  "New courses and sections appear automatically.": "Khóa học và học phần mới sẽ tự động xuất hiện.",
  "All folders": "Tất cả thư mục",
  "All courses": "Tất cả khóa học",
  "All sections": "Tất cả học phần",
  "Only learners and activity recorded today": "Chỉ học viên và hoạt động ghi nhận hôm nay",
  "Specific date": "Ngày cụ thể",
  "Choose the class date to export": "Chọn ngày học để xuất báo cáo",
  "All time": "Toàn bộ thời gian",
  "Export the complete learner history": "Xuất toàn bộ lịch sử học viên",
  "Exporting file…": "Đang xuất tệp…",
  "Download Excel file": "Tải tệp Excel",
  "DANGER · ADMINISTRATIVE ACTION": "LƯU Ý · THAO TÁC QUẢN TRỊ",
  "Reset all data?": "Xóa toàn bộ dữ liệu?",
  "Reset selected data?": "Xóa dữ liệu đã chọn?",
  "Loading current folders, courses and sections...": "Đang tải thư mục, khóa học và học phần...",
  "This action cannot be undone:": "Thao tác này không thể hoàn tác:",
  "Confirmation passcode": "Mã xác nhận",
  "Enter confirmation passcode": "Nhập mã xác nhận",
  "Deleting data…": "Đang xóa dữ liệu…",
  "Delete all data": "Xóa toàn bộ dữ liệu",
  "Delete selected data": "Xóa dữ liệu đã chọn",
  "Activate AI companion animation": "Kích hoạt chuyển động trợ lý AI",
  "Choose robot emotion": "Chọn biểu cảm robot",
  "Robot emotion": "Biểu cảm robot",
  "YOUR NEXT DISCOVERY": "KHÁM PHÁ TIẾP THEO",
  "No course access": "Chưa có quyền truy cập khóa học",
  "Return to access": "Quay lại đăng nhập",
  "Google sign-in is available only for the administrator account.": "Đăng nhập Google chỉ dành cho tài khoản quản trị viên.",
  "Google sign-in did not complete. Please try again.": "Đăng nhập Google chưa hoàn tất. Vui lòng thử lại.",
  "Enter your 6-digit passcode.": "Nhập mã truy cập gồm 6 chữ số.",
  "Please enter a valid passcode.": "Vui lòng nhập mã truy cập hợp lệ.",
  "Incorrect or inactive passcode. Please contact your instructor.": "Mã truy cập không đúng hoặc đã ngừng hoạt động. Vui lòng liên hệ giảng viên.",
  "Too many attempts. Please try again in 15 minutes.": "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.",
  "Unable to sign in right now. Please try again later.": "Hiện chưa thể đăng nhập. Vui lòng thử lại sau.",
  "Unable to sign in. Please check your passcode.": "Không thể đăng nhập. Vui lòng kiểm tra mã truy cập.",
  "Unable to sign in. Please verify your credentials.": "Không thể đăng nhập. Vui lòng kiểm tra thông tin đăng nhập.",
  "The operation was aborted due to timeout": "Kết nối quá thời gian chờ. Vui lòng thử lại.",
  "Failed to fetch": "Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.",
};

export function translateLearningText(language: LearningLanguage, english: string, vietnamese?: string) {
  if (language === "en") return english;
  if (vietnamese || messages[english]) return vietnamese || messages[english];
  const rules: [RegExp, (...parts: string[]) => string][] = [
    [/^Please enter (.+) \(up to 200 characters\)\.$/, field => `Vui lòng nhập ${field} (tối đa 200 ký tự).`],
    [/^Please enter a valid number for (.+)\.$/, field => `Vui lòng nhập số hợp lệ cho ${field}.`],
    [/^Please enter a valid (.+)\.$/, field => `Vui lòng nhập ${field} hợp lệ.`],
    [/^(.+) must be at least (.+)\.$/, (field, min) => `${field} phải lớn hơn hoặc bằng ${min}.`],
    [/^(.+) must be at most (.+)\.$/, (field, max) => `${field} phải nhỏ hơn hoặc bằng ${max}.`],
  ];
  for (const [pattern, format] of rules) {
    const match = english.match(pattern);
    if (match) return format(...match.slice(1));
  }
  return english;
}

export function useLearningLanguage() {
  const language = useSyncExternalStore(subscribe, snapshot, () => "en" as const);
  function setLanguage(next: LearningLanguage) {
    fallback = next;
    try { window.localStorage.setItem(LEARNING_LANGUAGE_KEY, next); } catch { /* Still usable with storage blocked. */ }
    window.dispatchEvent(new window.Event(changeEvent));
  }
  return { language, setLanguage, t: (english: string, vietnamese?: string) => translateLearningText(language, english, vietnamese) };
}
