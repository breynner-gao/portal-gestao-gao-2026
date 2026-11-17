const pdfLibrary = new URL('./vendor/html2pdf.bundle.min.js?v=0.14.0', import.meta.url);

function loadPdfLibrary(page) {
  if (page.html2pdf) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = page.document.createElement('script');
    script.src = pdfLibrary.href;
    script.onload = resolve;
    script.onerror = () => {
      script.remove();
      reject(new Error('O gerador de PDF está indisponível.'));
    };
    page.document.head.append(script);
  });
}

export function openReport(report, filename, {page = window.open('', '_blank'), orientation = 'portrait'} = {}) {
  if (!page) throw new Error('Permita pop-ups para abrir o relatório.');
  page.opener = null;
  const doc = page.document;
  doc.open();
  doc.write(report);
  doc.close();

  const toolbar = doc.querySelector('.print');
  const style = doc.createElement('style');
  style.textContent = `
    .print{position:sticky;top:0;z-index:1;padding:10px;background:#e2edf4;display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap}
    .print button{background:#2269a4;color:#fff;border:0;border-radius:6px;padding:9px 14px;min-height:44px;font:600 14px system-ui;cursor:pointer}
    .print button:disabled{opacity:.7;cursor:wait}
    .print p{flex-basis:100%;text-align:center;font:14px system-ui;margin:0}
    .print p:empty{display:none}
    @media print{.print{display:none}}
  `;
  doc.head.append(style);
  toolbar.innerHTML = '<button type="button" id="report-share">Compartilhar no WhatsApp</button><button type="button" id="report-download">Baixar PDF</button><button type="button" id="report-print">Imprimir / salvar PDF</button><p role="status"></p>';
  const share = doc.getElementById('report-share');
  const download = doc.getElementById('report-download');
  const status = toolbar.querySelector('[role="status"]');
  const fallback = 'Baixe o PDF e anexe o arquivo no WhatsApp.';
  let pdf;

  function getPdf() {
    if (!pdf) pdf = createPdf().then(file => {
      if (!file) pdf = null;
      return file;
    }).catch(error => {
      pdf = null;
      throw error;
    });
    return pdf;
  }

  async function createPdf() {
    await loadPdfLibrary(page);
    await doc.fonts?.ready;
    const content = doc.querySelector('main');
    const worker = page.html2pdf().set({
      margin: 11,
      image: {type: 'jpeg', quality: 0.94},
      html2canvas: {scale: 1.5, backgroundColor: '#fff', logging: false},
      jsPDF: {unit: 'mm', format: 'a4', orientation},
      pagebreak: {mode: ['css'], avoid: ['tr', 'article', 'header']}
    }).from(content).toContainer();
    const container = await worker.get('container');
    try {
      if (container.scrollHeight > 20000) {
        status.textContent = 'Este relatório é extenso. Use Imprimir / salvar PDF.';
        return null;
      }
      const blob = await worker.toCanvas().toPdf().outputPdf('blob');
      return new page.File([blob], filename + '.pdf', {type: 'application/pdf'});
    } finally {
      container.parentElement?.remove();
    }
  }

  async function exportPdf(action) {
    share.disabled = download.disabled = true;
    status.textContent = 'Preparando PDF…';
    try {
      const file = await getPdf();
      if (file) await action(file);
    } catch (error) {
      status.textContent = error.name === 'AbortError' ? '' : 'Não foi possível preparar o PDF. Use Imprimir / salvar PDF.';
    } finally {
      share.disabled = download.disabled = false;
    }
  }

  share.onclick = () => {
    if (!page.navigator.share || !page.navigator.canShare) {
      status.textContent = fallback;
      return;
    }
    return exportPdf(async file => {
      const payload = {files: [file]};
      if (!page.navigator.canShare(payload)) {
        status.textContent = fallback;
        return;
      }
      if (page.navigator.userActivation?.isActive === false) {
        status.textContent = 'PDF pronto. Toque novamente em Compartilhar no WhatsApp.';
        return;
      }
      try {
        status.textContent = '';
        await page.navigator.share(payload);
      } catch (error) {
        if (error.name !== 'AbortError') status.textContent = fallback;
      }
    });
  };
  download.onclick = () => exportPdf(file => {
    const link = doc.createElement('a');
    const url = page.URL.createObjectURL(file);
    link.href = url;
    link.download = file.name;
    doc.body.append(link);
    link.click();
    link.remove();
    page.setTimeout(() => page.URL.revokeObjectURL(url), 30000);
    status.textContent = '';
  });
  doc.getElementById('report-print').onclick = () => page.print();
}
