async function main() {
const fs = await import('node:fs');
const path = await import('node:path');
const { default: ExcelJS } = await import('exceljs');

const rawCsv = `Date,Product,Department,Amount
2025-01-05,Laptop Dell XPS 13,Kinh Doanh,25000000
2025-01-10,Chuot Logitech MX Master 3,Marketing,1850000
2025-01-15,Man hinh Samsung 27 inch IPS,Ky Thuat,5500000
2025-01-22,Ban phim co Keychron K2,Nhan Su,2200000
2025-02-03,Tai nghe Sony WH-1000XM5,Marketing,7500000
2025-02-08,Laptop Dell XPS 13,Ke Toan,25000000
2025-02-14,Webcam Logitech C920,Ky Thuat,1650000
2025-02-20,Man hinh Samsung 27 inch IPS,Kinh Doanh,5500000
2025-03-01,Chuot Logitech MX Master 3,Nhan Su,1850000
2025-03-07,Laptop Dell XPS 13,Marketing,25000000
2025-03-12,Ban phim co Keychron K2,Ky Thuat,2200000
2025-03-18,Tai nghe Sony WH-1000XM5,Ke Toan,7500000
2025-03-25,Webcam Logitech C920,Kinh Doanh,1650000
2025-04-02,Man hinh Samsung 27 inch IPS,Marketing,5500000
2025-04-09,Laptop Dell XPS 13,Nhan Su,25000000
2025-04-16,Chuot Logitech MX Master 3,Ky Thuat,1850000
2025-04-23,Ban phim co Keychron K2,Kinh Doanh,2200000
2025-05-05,Tai nghe Sony WH-1000XM5,Marketing,7500000
2025-05-12,Webcam Logitech C920,Ke Toan,1650000
2025-05-19,Laptop Dell XPS 13,Ky Thuat,25000000
2025-05-26,Man hinh Samsung 27 inch IPS,Kinh Doanh,5500000
2025-06-03,Chuot Logitech MX Master 3,Nhan Su,1850000
2025-06-10,Ban phim co Keychron K2,Marketing,2200000
2025-06-17,Tai nghe Sony WH-1000XM5,Kinh Doanh,7500000
2025-06-24,Webcam Logitech C920,Ky Thuat,1650000
2025-07-01,Laptop Dell XPS 13,Ke Toan,25000000
2025-07-08,Man hinh Samsung 27 inch IPS,Marketing,5500000
2025-07-15,Chuot Logitech MX Master 3,Ky Thuat,1850000
2025-07-22,Ban phim co Keychron K2,Nhan Su,2200000
2025-07-29,Tai nghe Sony WH-1000XM5,Kinh Doanh,7500000
2025-08-05,Webcam Logitech C920,Marketing,1650000
2025-08-12,Laptop Dell XPS 13,Ky Thuat,50000000
2025-08-19,Man hinh Samsung 27 inch IPS,Ke Toan,11000000
2025-08-26,Ban phim co Keychron K2,Kinh Doanh,4400000
2025-09-02,Tai nghe Sony WH-1000XM5,Nhan Su,15000000
2025-09-09,Chuot Logitech MX Master 3,Marketing,5550000
2025-09-16,Webcam Logitech C920,Ky Thuat,4950000
2025-09-23,Laptop Dell XPS 13,Kinh Doanh,25000000
2025-10-01,Man hinh Samsung 27 inch IPS,Marketing,5500000
2025-10-08,Ban phim co Keychron K2,Ke Toan,2200000
2025-10-15,Tai nghe Sony WH-1000XM5,Ky Thuat,7500000
2025-10-22,Chuot Logitech MX Master 3,Nhan Su,1850000
2025-10-29,Webcam Logitech C920,Kinh Doanh,1650000
2025-11-05,Laptop Dell XPS 13,Marketing,75000000
2025-11-12,Man hinh Samsung 27 inch IPS,Ky Thuat,16500000
2025-11-19,Ban phim co Keychron K2,Kinh Doanh,6600000
2025-11-26,Tai nghe Sony WH-1000XM5,Ke Toan,22500000
2025-12-03,Chuot Logitech MX Master 3,Marketing,7400000
2025-12-10,Webcam Logitech C920,Nhan Su,6600000
2025-12-17,Laptop Dell XPS 13,Kinh Doanh,50000000`;

const destCsv = path.join(__dirname, '../public/downloads/Sales-Data-2025.csv');
fs.writeFileSync(destCsv, rawCsv, 'utf8');
console.log('Saved CSV to', destCsv);

// Parse and write XLSX with sheet name "Sales"
const rows = rawCsv.trim().split('\n').map(r => r.split(','));
const data = rows.slice(1).map(r => ({
  Date: r[0],
  Product: r[1],
  Department: r[2],
  Amount: Number(r[3]),
}));

const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet('Sales');
worksheet.columns = [
  { header: 'Date', key: 'Date', width: 14 },
  { header: 'Product', key: 'Product', width: 34 },
  { header: 'Department', key: 'Department', width: 18 },
  { header: 'Amount', key: 'Amount', width: 16 },
];
worksheet.addRows(data);

const destXlsx = path.join(__dirname, '../public/downloads/Sales-Data-2025.xlsx');
await workbook.xlsx.writeFile(destXlsx);
console.log('Saved XLSX to', destXlsx);

}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

