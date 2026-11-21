# PDF Extractor

Upload a lab report PDF, and the app pulls out the test results table, saves it in PostgreSQL against the report ID and shows it back as a table.

Built for Problem 1 (PDF Report Data Extraction) of the full stack assignment, with NestJS, PostgreSQL and Next.js.

**Demo video:** _link to be added_

## What I built

- **Backend (NestJS):** two endpoints. `POST /reports` takes a PDF, reads it, finds the results table and saves it. `GET /reports` returns every saved report with its rows, newest first.
- **Database (PostgreSQL through TypeORM):** two tables, `reports` and `report_parameters`.
- **Frontend (Next.js + Bootstrap):** one page with an upload form and a table for each saved report. If the API rejects a file, the reason shows up in a red alert.
- **Sample PDFs:** four made-up lab reports in `samples/` that I tested with: 10, 12, 8 and 11 parameters. One of them is a scan.

```
backend/src/reports/
  pdf/pdf-reader.ts       reads text (or OCR) from each page, with positions
  pdf/report-parser.ts    finds the table and the report ID in that text
  entities/               the two tables
  reports.service.ts      checks, duplicate handling, saving
  reports.controller.ts   the two endpoints
frontend/app/
  page.tsx                upload form + list of reports
  components/             upload form and report table
  api.ts                  fetch calls to the backend
samples/                  the PDFs I tested with
```

## How the PDF is read

Lab reports don't share one layout, so I didn't want to hard-code positions for one lab. The idea is to find the table's header row first and then use the header's column positions to sort every later word into a column.

1. **Get the words and where they sit on the page.** pdf.js gives every piece of text with its x/y position. If a page has no text at all, it's a scanned image, so I render it at about 300 DPI and run Tesseract OCR on it (tesseract.js), which gives each word with its box. Either way, each page becomes a list of `{ text, x, y, width }`. Positions are stored as fractions of the page width and height, so page size doesn't matter.
2. **Build lines.** Words with almost the same y (within 0.8% of the page height) are one line. Words that sit close together on a line are joined into one cell, so "Total Cholesterol" stays one cell and doesn't get split into two columns.
3. **Find the header.** A line is the header if it has a name column (Test, Parameter, Investigation) and a value column (Result, Value, Observed). Unit and Reference / Normal range columns are picked up when they're there. I keep the x position where each header column starts.
4. **Read the rows.** Every line after the header is split into cells, and each cell goes under the last header column that starts at or before it. A row is kept only if it has a name plus at least one of value, unit or range. That drops section titles like "White Blood Cells". Lines like `Patient Name : ...`, "Page 1 of 2" and lone dashes are skipped, and reading stops at "End of report".
5. **Find the report ID.** A regex looks for "Report ID", "Report No", "Sample ID", "Sample No" and so on, followed by the code. If there's none, the report gets `AUTO-` plus the first 8 characters of the file's SHA-256 hash, so the same file always gets the same code.
6. **Save.** The report and all its rows are saved in one transaction, so a failure never leaves half a report behind.

## Database design

```
reports                              report_parameters
-------                              -----------------
id           serial PK        <--    report_id        FK, ON DELETE CASCADE, indexed
report_code  varchar UNIQUE          id               serial PK
file_name    varchar                 position         int
file_hash    char(64) UNIQUE         name             varchar
created_at   timestamptz             value            varchar NULL
                                     unit             varchar NULL
                                     reference_range  varchar NULL
```

The number of parameters changes from report to report, so parameters are rows, not columns. A report with 8 tests has 8 rows in `report_parameters` and one with 12 has 12. Nothing in the schema changes when a new kind of report comes in.

Some details:

- `value`, `unit` and `reference_range` are text and can be NULL. Values like `<5`, `Positive` and `Nil` are stored exactly as printed, and a missing unit or range is just NULL.
- `position` keeps the order of the rows in the PDF, because the UI should show them in the same order.
- `report_code` is unique because the brief says data is stored against a report or sample ID. `file_hash` is unique so the exact same file can't be saved twice. Both rules live in the database, so two uploads at the same moment can't get around them.
- I named the column `report_code` and not `report_id`, so it doesn't get mixed up with the `report_id` foreign key in the other table.
- I also thought about putting all parameters in one JSONB column on `reports`. That would be simpler, but a separate table keeps every result as a real row that can be queried (for example, every Hemoglobin value), and constraints work on it.

## Edge cases

| Case | What happens | Sample |
|---|---|---|
| Scanned PDF (image only) | Pages without text are read with OCR | `liver-function-scanned.pdf` |
| Missing value, unit or range | Saved as NULL, shown as `-` | `urine-routine-8-params-no-id.pdf` |
| Values that aren't numbers (`<5`, `Positive`, `Nil`) | Stored as text, as printed | `urine-routine-8-params-no-id.pdf` |
| Same PDF uploaded twice | 409, "This PDF has already been uploaded" (SHA-256 hash) | any |
| Different file with an ID that's already saved | 409, "Report X has already been uploaded" | |
| No report ID in the PDF | Gets `AUTO-` + first 8 characters of the file hash | `urine-routine-8-params-no-id.pdf` |
| Table carries on to the next page | Columns are remembered from the last header, so page 2 works with or without a repeated header | `lipid-thyroid-12-params.pdf` (header repeated), `liver-function-scanned.pdf` (no header on page 2) |
| Non-PDF file, even if renamed to `.pdf` | 400, the file has to have the `%PDF-` marker near the start | |
| Corrupted or cut-off PDF | 400, "This PDF is damaged and could not be read" | |
| PDF with no results table | 422, "Could not find a test results table in this PDF" | |
| File over 10 MB | 413 | |
| More than 20 pages | 400. OCR takes a few seconds a page, so very long files are refused | |
| No file in the request | 400, "Please choose a PDF file" | |
| OCR itself fails | 500, and the real error is logged. It's a server problem, so it isn't reported as a bad file | |
| Page with a huge declared size | The OCR image is capped at 4000 px on its longest side, so a crafted PDF can't use up all the memory | |

## Running it locally

You need Node.js 22.13+ or 24.11+ (what pdf.js and TypeORM support; I used 22) and PostgreSQL (I used 18).

**1. Create the database.** It has to use UTF-8, because units like `µg/dL` don't fit in other encodings. With Docker:

```bash
docker run --name pdf-extractor-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=pdf_extractor -p 5432:5432 -d postgres:18
```

Or on a Postgres that's already installed:

```bash
psql -U postgres -c "CREATE DATABASE pdf_extractor ENCODING 'UTF8' TEMPLATE template0"
```

**2. Start the backend** (http://localhost:4000):

```bash
cd backend
cp .env.example .env     # change DATABASE_URL if your login is different
npm install
npm run start:dev
```

The tables are created when the backend starts. The English OCR data comes with the npm package, so scanned PDFs work offline.

**3. Start the frontend** (http://localhost:3000), in a second terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:3000 and upload any file from `samples/`.

## Assumptions

- Reports are in English, and the results table has a header row using words like Test / Parameter / Investigation and Result / Value / Observed.
- A report ID is unique. If a second file comes in with an ID that's already saved, I treat it as a duplicate, not as a new version of the report.
- Values are kept exactly as printed. I don't convert units or turn values into numbers.
- There are no user accounts, since the brief doesn't mention any. Anyone who can open the app can upload files and see every report.
- Uploads are limited to 10 MB and 20 pages.

## Limitations

- A test name that wraps onto a second line only keeps its first line.
- OCR can misread things. In the scanned sample, the range `1.1 - 2.2` comes out as `11-22`. There's no confidence check yet.
- OCR runs inside the upload request, so a scanned page takes a few seconds. With real traffic I'd move it to a job queue with a fixed number of workers and add rate limiting.
- No login, so report IDs are unique across everyone. With accounts, I'd make them unique per lab or per user.
- `GET /reports` returns everything, with no pagination.
- The tables are created by TypeORM's `synchronize` on startup. It's turned off when `NODE_ENV=production`, and a real deployment would use migrations.
- There are no automated tests. I tested by hand with the four samples plus a set of broken files: a renamed text file, a cut-off PDF, an 11 MB file, a 21-page file and a PDF with a huge page size.

## AI tools

I used **Claude Code** (Anthropic's coding agent in the terminal) for most of this project. It helped me plan the work in parts, wrote most of the backend and frontend code, made the sample PDFs with a small Python script (reportlab), ran the tests through curl and a browser, and drafted this README and the commit messages. I set the scope (only what the brief asks for), and I reviewed and approved the plan and the database design before any code was written.
