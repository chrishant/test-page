# Printer Share

A tiny local web server that lets any device on your Wi-Fi/LAN print to a
printer connected to this Windows PC — just by dragging a file into a browser page.

## 1. Requirements

- **Node.js** installed on the Windows PC that has the printer (v16+). Get it from https://nodejs.org
- The printer already installed in Windows (`Settings > Bluetooth & devices > Printers & scanners`) — it works whether the printer is USB, wireless, or already shared via Windows.
- All devices (the PC and the phones/laptops printing to it) on the **same network**.

## 2. Install

Open a terminal (PowerShell or Command Prompt) in this folder and run:

```
npm install
```

This installs Express, Multer, and `pdf-to-printer` (which bundles a small
SumatraPDF binary used to actually send files to the printer — no extra
install needed).

## 3. Run the server

```
npm start
```

You'll see output like:

```
Printer share server running.
  Local:   http://localhost:3000
  Network: http://192.168.1.42:3000

Share a "Network" link above with other devices on the same Wi-Fi/LAN.
```

Keep this terminal window open — closing it stops the server.

## 4. Print from any device

On your phone, laptop, or tablet (same network), open a browser and go to
the **Network** address shown above, e.g. `http://192.168.1.42:3000`.

- Pick a printer from the dropdown (your Windows default is pre-selected).
- Set number of copies if needed.
- Drag a file onto the drop zone (or tap it to browse), then hit **Print**.

## 5. Supported file types

Printing is handled by SumatraPDF under the hood, so these types print
directly without needing Word/Office/Adobe installed:

- PDF, XPS
- Images: PNG, JPG, GIF, BMP, TIFF
- EPUB, MOBI, DjVu, CBZ, CBR

**Not supported out of the box:** .docx, .xlsx, .pptx (these need Microsoft
Office or LibreOffice installed to convert to PDF first). If you need that,
let me know and I can add automatic conversion via LibreOffice.

## 6. Building a standalone .exe (no Node.js needed to run it)

This turns the server into a `PrinterShare.exe` that anyone can double-click —
they won't need Node.js installed. You (or whoever sets it up) still need
Node.js **once**, to build it.

1. Open a terminal in this folder and run:
   ```
   build.bat
   ```
   This installs dependencies, compiles the app with `pkg`, and copies the
   one native helper file (`SumatraPDF.exe`, used for actual printing) next
   to the compiled app automatically.

2. When it finishes, you'll have a `dist` folder containing:
   ```
   dist/
     PrinterShare.exe
     bin/
       SumatraPDF.exe
   ```
   **Keep `bin/SumatraPDF.exe` next to the `.exe`** — the app looks for it
   there. You can move/rename/zip the whole `dist` folder as a unit and it'll
   still work anywhere.

3. Double-click `PrinterShare.exe`. A console window opens (that's the
   server — leave it running) and your browser automatically opens the same
   drag-and-drop page as before. Other devices on the network still connect
   via the "Network" address shown in that console window.

**If it says it can't find SumatraPDF / printing fails after building:**
run `node locate-sumatra.js` in this folder — it prints the real path to the
binary pdf-to-printer installed. Manually copy that file to
`dist\bin\SumatraPDF.exe` and try again. (This can happen if a future
`pdf-to-printer` version changes its internal folder layout — the script
finds it dynamically either way.)

### Building on one PC, running on another (no Node needed on the printer PC)

You can run `build.bat` on any Windows machine — it doesn't have to be the
one with the printer. Once it finishes:

1. You'll have a `dist` folder with `PrinterShare.exe` and `bin\SumatraPDF.exe` inside.
2. Copy the **whole `dist` folder** (both files together — don't separate
   them) to the printer PC using a USB drive, network share, email, etc.
3. On the printer PC, just double-click `PrinterShare.exe`. That's it — no
   Node, npm, or any install step needed there at all.

## 7. Adding it as a real Windows printer (no web page needed)

Besides the drag-and-drop web page, the app also runs a small network-printer
service. This means colleagues can add it **once** as an actual installed
printer, and from then on print to it directly from Chrome's normal Print
dialog, Word, or any other app — no browser page required.

**On each colleague's PC:**

1. Settings > Bluetooth & devices > Printers & scanners > **Add device**.
2. Click **"The printer that I want isn't listed."**
3. Choose **"Select a shared printer by name"** and enter the address shown
   in the PrinterShare console window when it starts, e.g.:
   ```
   http://192.168.1.49:631/ipp/print
   ```
4. Windows installs it as a normal printer (using its built-in IPP driver —
   no extra driver download needed). It'll now show up in every app's Print
   dialog.

**Notes and limits:**

- This has been tested to correctly receive and hand off print jobs, but
  hasn't been verified against a live Windows "Add Printer" wizard on real
  hardware — some Windows versions are pickier about IPP than others. If a
  colleague's Windows can't add it this way, the drag-and-drop web page
  (section 4) always still works as a fallback.
- By default, jobs are sent to the printer PC's *default* Windows printer.
  To target a specific printer instead, set an environment variable before
  starting the app: `set IPP_TARGET_PRINTER=Your Printer Name && PrinterShare.exe`
  (get the exact name from the dropdown on the web page).
- Like the web page, this has no login — anyone on the network can print to
  it. Don't expose it outside a trusted LAN.
- The first time it starts, Windows Firewall may separately prompt to allow
  traffic on port 631 (the standard IPP port) — click Allow.
- Multiple copies aren't reliably passed through this path yet — for
  multi-copy jobs, use the web page's Copies field instead.

## 8. Notes & troubleshooting

- **Windows Firewall**: the first time you run `npm start`, Windows may ask
  to allow Node.js through the firewall on private networks — click **Allow**.
- **Port already in use**: change the port with `set PORT=4000 && npm start`
  (PowerShell: `$env:PORT=4000; npm start`).
- **Finding the PC's IP manually**: run `ipconfig` in a terminal and look for
  "IPv4 Address" under your active network adapter.
- **File size limit**: capped at 50MB per file by default — change
  `limits.fileSize` in `server.js` if you need more.
- **Auto-start on boot**: you can wrap this with a tool like
  [pm2](https://pm2.keymetrics.io/) or Windows Task Scheduler if you want it
  to run automatically without opening a terminal each time.
- This is designed for trusted home/office LANs. It has no login/auth — don't
  expose port 3000 to the public internet without adding authentication.
