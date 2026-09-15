# EIU Section 2 · Slides 29–32 Download & Motion Patch

Patch này được tạo trên phiên bản Section 2 mới nhất trong chuỗi cập nhật hiện tại.

## Cách cài

1. Giải nén file ZIP.
2. Mở folder `EIU_Section2_Slides_29_32_Download_Motion_Patch`.
3. Kéo hai folder `components` và `public` vào thư mục gốc của project hiện tại.
4. Chọn **Replace / Replace the files in the destination** khi được hỏi.
5. Chạy kiểm tra:

```powershell
npm run build
```

6. Nếu build thành công, push lên GitHub:

```powershell
git add components/section2 public/downloads
git commit -m "Update Section 2 slides 29 to 32"
git push origin main
```

## Nội dung thay đổi

- Slide 29: bốn khung quay đúng hai vòng rồi tự dừng ở bố cục hai hàng, đúng thứ tự 1 → 4.
- Slide 30: thêm một nút tải đồng thời ba file thực hành:
  - `Gemini-Prompt.txt`
  - `App-01-Source.zip`
  - `App-02-Source.zip`
- Slide 30–32: thêm strong motion, hiệu ứng nền và reveal mạnh hơn; không đổi nội dung gốc.
- Bổ sung trạng thái tĩnh cho người dùng bật `prefers-reduced-motion`.

## Kiểm tra nhanh

- Vào slide 29 và chờ animation kết thúc: các khung phải nằm đúng thứ tự 1, 2 ở hàng trên; 3, 4 ở hàng dưới.
- Bấm nút **Tải bộ 3 file thực hành** ở slide 30. Trình duyệt có thể hỏi quyền tải nhiều file; chọn **Allow / Cho phép**.
- Mở slide 31 và 32 để kiểm tra hiệu ứng mạnh và nội dung không bị thay đổi.

## Xác nhận kỹ thuật

- ESLint: đạt.
- Next.js production build: đạt.
