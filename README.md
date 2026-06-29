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

