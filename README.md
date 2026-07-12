# Retool Odoo Frontend

Standalone React dashboard for monitoring Retool to Odoo transaction sync status.

## Requirements

- Node.js 22+
- npm 10+
- Backend API expected at `http://localhost:8080/api/v1`

## Setup

```bash
npm install
npm run dev
```

The API base URL is configured in `.env`:

```text
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

## Notes

- The dashboard calls the real backend API first.
- If `/transactions` is not available yet or CORS blocks the request, the UI shows an error banner and demo rows so the layout can still be reviewed.
- Retry calls still use the real backend endpoint: `POST /transactions/{transactionId}/retry`.

## Import API

The import endpoint used by the frontend is:

```text
POST /transactions/ingest
```

With the default base URL, the full endpoint is:

```text
POST http://localhost:8080/api/v1/transactions/ingest
```

It receives a JSON array. Each item should follow this shape:

```json
[
  {
    "date": "10/1/2025",
    "txn_id": "CSO251001-105M4QGI94",
    "journal_id": "ANBCAO251001-10000ESKEV0R",
    "account_number": "9911",
    "amount": 25,
    "cr_dr": "DR",
    "value_date": "10/1/2025",
    "created_at": "10/1/2025 21:31"
  }
]
```

The frontend still sends legacy-compatible fields when importing files, but the dashboard tables and exports are ordered as:

```text
transaction date, txn_id, journal_id, account_number, amount, cr_dr, value_date, created_at
```
