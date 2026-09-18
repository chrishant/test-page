const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const { print, getPrinters, getDefaultPrinter } = require('pdf-to-printer');
const { startIppServer } = require('./ipp-server');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Resolve base directory (works both as plain node app and as a pkg .exe) ---
// When packaged with pkg, process.pkg exists and process.execPath is the .exe location.
const isPkg = typeof process.pkg !== 'undefined';
const baseDir = isPkg ? path.dirname(process.execPath) : __dirname;

// If a real SumatraPDF.exe sits in a "bin" folder next to the app/exe, use it explicitly.
// (Native binaries can't run from inside a pkg snapshot, so the build script copies it out.)
const externalSumatra = path.join(baseDir, 'bin', 'SumatraPDF.exe');
const sumatraOverride = fs.existsSync(externalSumatra) ? externalSumatra : null;

// --- Upload storage setup ---
const uploadDir = path.join(baseDir, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

// SumatraPDF (used under the hood) handles: PDF, XPS, DjVu, CBZ/CBR, EPUB, MOBI, and common images (PNG/JPG/etc).
const ALLOWED_EXT = ['.pdf', '.xps', '.djvu', '.cbz', '.cbr', '.epub', '.mobi',
                      '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tif', '.tiff'];

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB cap
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXT.includes(ext)) cb(null, true);
    else cb(new Error(`Unsupported file type: ${ext}`));
  }
});

app.use(express.static(path.join(__dirname, 'public'))); // works inside pkg snapshot (static files are fine embedded)
app.use(express.json());

// --- List available printers ---
app.get('/printers', async (req, res) => {
  try {
    const printers = await getPrinters();
    let defaultPrinter = null;
    try { defaultPrinter = await getDefaultPrinter(); } catch (_) {}
    res.json({ printers, default: defaultPrinter ? defaultPrinter.name : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Handle upload + print ---
app.post('/print', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file received.' });
    }

    const filePath = req.file.path;
    const printerName = req.body.printer || undefined;
    const copies = parseInt(req.body.copies, 10) || 1;

    try {
      const options = {};
      if (printerName) options.printer = printerName;
      if (copies > 1) options.copies = copies;
      if (sumatraOverride) options.sumatraPdfPath = sumatraOverride;

      await print(filePath, options);

      res.json({
        success: true,
        message: `"${req.file.originalname}" sent to ${printerName || 'default printer'}${copies > 1 ? ` (${copies} copies)` : ''}.`
      });
    } catch (printErr) {
      res.status(500).json({ success: false, error: printErr.message });
    } finally {
      // Clean up the temp file after a short delay (print spooler needs the file briefly)
      setTimeout(() => fs.unlink(filePath, () => {}), 30000);
    }
  });
});

// --- Helper: show LAN IPs on startup ---
function getLanIPs() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }
  return ips;
}

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
            : process.platform === 'darwin' ? `open "${url}"`
            : `xdg-open "${url}"`;
  exec(cmd, (err) => { if (err) console.log(`(Could not auto-open browser: ${err.message})`); });
}

app.listen(PORT, '0.0.0.0', () => {
  const localUrl = `http://localhost:${PORT}`;
  console.log(`\nPrinter share server running.`);
  console.log(`  Local:   ${localUrl}`);
  getLanIPs().forEach(ip => console.log(`  Network: http://${ip}:${PORT}`));
  console.log(`\nShare a "Network" link above with other devices on the same Wi-Fi/LAN.`);
  console.log(`Keep this window open — closing it stops the server.\n`);
  openBrowser(localUrl);

  startIppServer(baseDir, sumatraOverride, 'Printer Share');
});
