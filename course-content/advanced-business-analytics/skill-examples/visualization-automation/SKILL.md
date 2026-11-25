---
name: excel-interactive-visualizer
description: Automatically analyze an uploaded Excel (.xlsx, .xls) or CSV file and generate a standalone, downloadable, shareable single-file HTML interactive dashboard (.html) with visual filters, KPI cards, and dynamic charts (do NOT render in the chat web canvas), along with a 1-step temporary link publishing guide. Use whenever a user uploads a spreadsheet or asks to analyze data, build a shareable dashboard, visualize Excel data, or generate charts without external third-party tools.
---

# Excel Interactive Visualizer

Automatically inspect and analyze an uploaded Excel or CSV dataset, then build and export a standalone, self-contained, shareable `.html` dashboard file for download (do NOT open or embed it in the chat web canvas), accompanied by a 1-step publishing guide so the user can copy-paste the HTML or drop the file to get a temporary shareable online link immediately without signing up.

## When to Use

  - The user uploads an Excel (`.xlsx`, `.xls`) or `.csv` file and wants to visualize, explore, or analyze it.
  - The user asks for an interactive dashboard, charts, or dynamic filtering that can be downloaded and shared via an online link or standalone HTML file without third-party BI platforms.
  - The user wants a ready-to-use, shareable visual report immediately upon uploading data with zero manual configuration.

## Workflow

### Step 1: Parse and Analyze the Uploaded File

1.  Inspect the uploaded file structure, sheet names, column headers, and data types (dates, categorical dimensions, numeric metrics, currencies, percentages) using Python (`google:ds_python_interpreter`).
2.  Clean and normalize the dataset:
      - Handle missing values, merged headers, or summary/total rows at the bottom so they do not skew aggregations.
      - Standardize date formats and numeric strings (strip currency symbols or commas before parsing numbers).
3.  Identify the best visualization layout automatically:
      - **KPI Cards (3 to 5 metrics):** Total volume, revenue/sum, averages, growth rates, or top-performing category.
      - **Time-Series Chart:** Line or area chart if a date/time column exists.
      - **Category Breakdown:** Bar, horizontal bar, or doughnut chart for key categorical columns.
      - **Interactive Data Table:** Searchable, sortable preview table of the underlying records.

### Step 2: Design Custom Bright UI & Visual Filters

Avoid default browser styles or plain unstyled chart templates. Apply a cohesive, modern, light-mode visual theme:

  - **Color Palette (Bright & Tailored):**
      - Background: Soft warm off-white or crisp slate-tinted canvas (`#F8FAFC` or `#F4F6F9`) with pure white (`#FFFFFF`) elevated cards and subtle `1px solid #E2E8F0` borders.
      - Primary Accent & Palette: Use a curated, high-contrast harmonious palette tailored to the domain (for example: Indigo `#4F46E5`, Teal `#0D9488`, Amber `#F59E0B`, Coral `#F43F5E`, Sky `#0284C7`) rather than default Chart.js/ECharts primary colors.
      - Typography: Clean sans-serif hierarchy (`Inter`, `Plus Jakarta Sans`, or system-ui) with clear contrast (`#0F172A` headings, `#475569` labels).
  - **Visual Filter Bar:**
      - Place a prominent, intuitive filter bar at the top of the dashboard.
      - Include interactive dropdowns/multi-select pills for categorical columns, date range selectors (if dates exist), and a global keyword search box.
      - Include a **Reset Filters** button and live indicator showing filtered row count vs. total rows.
      - All KPI cards, charts, and data tables must update reactively and smoothly when any filter changes.

### Step 3: Export Standalone Shareable HTML File

1.  **Generate a downloadable `.html` file via Python (`google:ds_python_interpreter`):**
      - Write the complete, self-contained HTML document directly to a descriptive `.html` file (e.g., `<dataset-name>-dashboard.html`) using Python so the user receives a downloadable file link/attachment they can save and share with others.
      - **Do NOT use `web_code_canvas`** and **do NOT render the dashboard inside the chat interface**. The deliverable must strictly be the downloadable `.html` file.
2.  **Self-Contained Architecture for Easy Sharing:**
      - Embed the parsed, cleaned JSON dataset directly inside a `<script>` tag in the HTML file so anyone opening the `.html` file in any browser (Chrome, Edge, Safari, Firefox) can view and interact with it offline/locally with zero backend setup.
      - Load lightweight charting libraries via reliable public CDNs (e.g., Chart.js or ApexCharts) so the single `.html` file stays small, fast, and portable.
      - Include a clear dashboard header with dataset title, generation date, and an optional "Export Filtered CSV" button inside the HTML page for recipients.
3.  **Chat Response Format (Include Instant Temporary Link Box):**
      - Return the downloadable `.html` file tag cleanly, followed by a concise 2–3 bullet summary of the key insights found in the data.
      - Immediately below the summary, always render a short, clear callout/guide box (matching the user's language) explaining how to get a **temporary online link in 1 step without logging in**:
        - **Copy & Paste HTML (10 seconds, no signup):** Open the downloaded `.html` file with Notepad/TextEdit, select all (`Ctrl+A` / `Cmd+A`) and copy (`Ctrl+C` / `Cmd+C`), paste into **OneClickLive** or **HTML to URL**, and click Deploy/Generate to get a temporary shareable link immediately.
        - **Or Drag & Drop file (no signup):** Drag the `.html` file directly onto **ShareMyHTML** or **HTMLPUT** to get a live URL without creating an account.

## Gotchas

  - **Never deploy to `web_code_canvas`:** Even though the output is an HTML dashboard, always output it as a downloadable `.html` file via `google:ds_python_interpreter` instead of opening an inline chat preview.
  - **Do not ask clarifying questions before building** when the user simply uploads an Excel file expecting instant visualization. Infer the best metrics and charts automatically, and let the user tweak them via the interactive filters.
  - **Avoid double-counting summary rows:** Many Excel sheets end with a "Total" or "Tổng cộng" row. Detect and exclude total rows from the raw data array before computing KPI sums and charts.
  - **Keep embedded data clean and lightweight:** If an Excel file has dozens of unused empty columns or thousands of rows, trim empty columns and optimize JSON keys so the shared `.html` file remains lightweight and fast to open.
  - **Never use default library color schemes:** Explicitly define custom `backgroundColor`, `borderColor`, hover states, and rounded bar corners (`borderRadius`) in chart configurations.
