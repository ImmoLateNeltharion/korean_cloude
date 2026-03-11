import html2canvas from 'html2canvas';

async function toBase64(url: string): Promise<string> {
  const resp = await fetch(url);
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function downloadPNG(): Promise<void> {
  const canvas = await html2canvas(document.body, {
    useCORS: true,
    scale: 2,
    logging: false,
    backgroundColor: '#0a0a0a',
  });
  const link = document.createElement('a');
  link.download = `word-tower-${new Date().toISOString().slice(0, 10)}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export async function downloadHTML(): Promise<void> {
  // Collect all CSS rules from loaded stylesheets
  let styles = '';
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) styles += rule.cssText + '\n';
    } catch { /* cross-origin sheet */ }
  }

  // Embed assets as base64 so HTML works offline
  const assets: Record<string, string> = {};
  for (const path of ['/fonts/Vatech-Regular.otf', '/seoul-night-bg.jpg']) {
    try { assets[path] = await toBase64(path); } catch { /* skip */ }
  }

  // Patch font URL in collected CSS
  if (assets['/fonts/Vatech-Regular.otf']) {
    styles = styles.replace(
      /url\(['"]?\/fonts\/Vatech-Regular\.otf['"]?\)[^;,)]*/g,
      `url('${assets['/fonts/Vatech-Regular.otf']}') format('opentype')`
    );
  }

  // Clone body HTML and patch asset URLs
  let bodyHTML = document.body.innerHTML;
  if (assets['/seoul-night-bg.jpg']) {
    bodyHTML = bodyHTML.replace(/url\(["']?\/seoul-night-bg\.jpg["']?\)/g,
      `url('${assets['/seoul-night-bg.jpg']}')`);
  }

  const timestamp = new Date().toLocaleString('ru');
  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Word Tower — ${timestamp}</title>
  <style>
    * { box-sizing: border-box; }
${styles}
  </style>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;">
${bodyHTML}
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const link = document.createElement('a');
  link.download = `word-tower-${new Date().toISOString().slice(0, 10)}.html`;
  link.href = URL.createObjectURL(blob);
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}
