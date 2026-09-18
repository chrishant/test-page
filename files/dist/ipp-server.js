// Exposes the shared printer as a real IPP network printer, so Windows PCs
// can add it once via "Add a printer > The printer that I want isn't
// listed > Select a shared printer by name" and get a normal installed
// printer that shows up in every app's Print dialog (Chrome, Word, etc.) —
// no need to visit the web page each time.
const { Printer } = require('virtual-printer');
const ipp = require('ipp');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { print } = require('pdf-to-printer');

const IPP_PORT = process.env.IPP_PORT || 631;

// Which real Windows printer IPP jobs get sent to. Defaults to the system's
// default printer. Override by setting the IPP_TARGET_PRINTER environment
// variable to an exact printer name (see the /printers list in the app).
const TARGET_PRINTER = process.env.IPP_TARGET_PRINTER || undefined;

function getLanIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

// Best-effort extraction of the "copies" job attribute. virtual-printer's
// own 'data' event doesn't expose it, but the raw request body is a
// standard IPP message we can re-parse ourselves.
function extractCopies(rawBuffer) {
  try {
    const parsed = ipp.parse(rawBuffer);
    const copies =
      (parsed['job-attributes-tag'] && parsed['job-attributes-tag'].copies) ||
      (parsed['operation-attributes-tag'] && parsed['operation-attributes-tag'].copies);
    const n = parseInt(copies, 10);
    return n > 1 ? n : 1;
  } catch {
    return 1;
  }
}

function startIppServer(baseDir, sumatraOverride, printerDisplayName) {
  const lanIP = getLanIP();
  const printerUrl = `http://${lanIP}:${IPP_PORT}/ipp/print`;

  const printer = new Printer({
    serverUrl: new URL(`http://0.0.0.0:${IPP_PORT}`),
    printerUriSupported: new URL(printerUrl.replace('http://', 'ipp://')),
    name: printerDisplayName || 'Printer Share',
    description: 'Shared via Printer Share',
    location: 'Local network',
    format: ['application/pdf'],
    bonjour: false,
  });

  const ippUploadDir = path.join(baseDir, 'uploads');
  if (!fs.existsSync(ippUploadDir)) fs.mkdirSync(ippUploadDir);

  printer.on('server-opened', (error) => {
    if (error) {
      console.log(`\n(Could not start the network-printer service: ${error.message})`);
      console.log('Colleagues can still print via the web page above.\n');
      return;
    }
    console.log(`Also available as a real Windows printer:`);
    console.log(`  On each colleague's PC: Settings > Printers & scanners > Add device`);
    console.log(`  > "The printer that I want isn't listed" > "Select a shared printer by name"`);
    console.log(`  > enter: ${printerUrl}`);
    console.log(`  (Windows Firewall may prompt to allow this the first time.)\n`);
  });

  printer.on('data', async (handledJob, data, request) => {
    const copies = extractCopies(request.body);
    const tempFile = path.join(
      ippUploadDir,
      `ipp-${Date.now()}-${Math.round(Math.random() * 1e9)}.pdf`
    );

    try {
      fs.writeFileSync(tempFile, data);
      const options = {};
      if (TARGET_PRINTER) options.printer = TARGET_PRINTER;
      if (copies > 1) options.copies = copies;
      if (sumatraOverride) options.sumatraPdfPath = sumatraOverride;

      await print(tempFile, options);
      console.log(`[network printer] Printed job from ${handledJob['job-originating-user-name'] || 'unknown user'}: ${handledJob['job-name'] || tempFile}`);
    } catch (err) {
      console.log(`[network printer] Failed to print incoming job: ${err.message}`);
    } finally {
      setTimeout(() => fs.unlink(tempFile, () => {}), 30000);
    }
  });

  return printer;
}

module.exports = { startIppServer };
