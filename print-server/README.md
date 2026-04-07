# Alan POS — Local Print Server

Runs on `http://localhost:12345`. Converts receipt JSON to ESC/POS and sends to a USB thermal printer via the Windows print spooler.

## Setup

```bash
cd print-server
npm install
node server.js
```

## Requirements

- Node.js 18+
- Xprinter (or compatible) 58mm USB printer **installed as a Windows printer**
- The printer must appear in **Settings → Bluetooth & devices → Printers & scanners**

## Configure your printer name

By default the server looks for a printer named **`XP-58`**.
Find your actual printer name in Windows Printers list, then either:

**Option A — env var (one-time):**
```
set PRINTER_INTERFACE=printer:Your Printer Name
node server.js
```

**Option B — permanent (edit server.js line 16):**
```js
const PRINTER_INTERFACE = process.env.PRINTER_INTERFACE || 'printer:Your Printer Name'
```

## Endpoints

| Method | Path | Body |
|--------|------|------|
| `POST` | `/print` | Receipt JSON (see below) |
| `GET`  | `/status` | — (returns `{ connected: bool }`) |

## Receipt JSON schema

```json
{
  "shop_name": "ALAN COFFEE & TRAVEL",
  "queue": 1,
  "receipt": "A001",
  "table": "1",
  "customer": "Alan",
  "cartSnapshot": [
    {
      "qty": 2,
      "recipe": { "product_name": "Americano", "price_lak": 15000 },
      "customization": "เย็น หวานน้อย"
    }
  ],
  "subtotal": 30000,
  "discountAmt": 0,
  "discount_reason": "",
  "finalTotal": 30000,
  "method": "cash",
  "received": 50000,
  "change": 20000,
  "vat_percent": 0
}
```

## Thai text not printing correctly?

The server uses **PC874 (TIS-620)** code page for Thai text. If your printer shows garbled Thai characters, try `CharacterSet.PC437_USA` in `server.js` line 40 — Thai will not print but numbers and English will be correct.

## Run on startup (Windows)

1. Create `start-printserver.bat`:
   ```bat
   @echo off
   cd /d C:\path\to\alan-coffee-travel\print-server
   node server.js
   ```
2. Press `Win+R` → `shell:startup` → paste the `.bat` file there

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Printer not connected` | Check printer name in Windows Printers list |
| `Cannot init printer` | Run `npm install` again; node-gyp may need Visual C++ Build Tools |
| Thai text garbled | See "Thai text" section above |
| Port 12345 in use | Change `PORT` constant in `server.js` and update `/pos` settings |
