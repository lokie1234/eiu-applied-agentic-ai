# Result report

Respond in the user's language. Scale the report to the work; do not force a lengthy template for a small edit.

For substantial work, communicate these facts:

- **Visible change:** concrete behavior before and after, or exactly which visual element changed. Example: “The save button now keeps its width while loading and shows a success state.”
- **Cleanup:** what was removed and why it was redundant, or omit this point when nothing was removed.
- **Verification:** the checks actually run, result, browser/viewports if inspected, and any pre-existing failure.
- **Remaining limit:** a real unverified scenario or blocker. Do not fabricate one merely to fill a section.

Link a real preview/screenshot when available. For code references, choose the few locations that help the user inspect the result. Supply a patch when requested; a raw diff is not the default explanation. Distinguish local work from commits, pushes and live deployment.

Example, with illustrative values only:

> Đã đồng bộ ba thẻ sản phẩm về cùng font, khoảng cách và vị trí nút. Tiêu đề dài tự xuống dòng mà không làm nút lệch hàng. Bỏ hai lớp CSS cũ bị ghi đè. Đã kiểm tra trang ở 390px và 1440px, chạy typecheck và test luồng chọn gói; đều đạt. Chưa kiểm tra Safari.

Never copy this example as claimed evidence. Replace it with the actual outcome and checks.
