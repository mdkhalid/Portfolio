const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

/**
 * Generate a clean, ATS-friendly single-column resume PDF from plain text.
 * Follows ATS best practices: no tables/columns/images, standard headings,
 * keyword-rich skills section, generous spacing.
 *
 * @param {Object} opts
 * @param {string} opts.title - Job title header (e.g. "Senior Solution Architect")
 * @param {string} opts.name - Candidate name
 * @param {string} opts.summary - Optional professional summary paragraph
 * @param {Array<string>} opts.skills - Keyword list rendered as a comma list
 * @param {Array<{role,company,dates,points}>} opts.experience
 * @param {Array<string>} opts.education
 * @param {Array<string>} opts.certifications
 * @returns {Promise<Buffer>} PDF bytes
 */
async function buildResumePdf({
  name = '',
  title = '',
  summary = '',
  skills = [],
  experience = [],
  education = [],
  certifications = [],
} = {}) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title || 'Resume');
  pdf.setAuthor(name || 'Candidate');

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const MARGIN = 56;
  const pageWidth = 612; // US Letter
  const contentWidth = pageWidth - MARGIN * 2;
  const fontSize = 10;
  const lineGap = 4;
  const smallSize = 9;

  let page = pdf.addPage();
  let y = page.getHeight() - MARGIN;

  const wrapText = (text, maxWidth, f) => {
    const words = String(text || '').split(/\s+/);
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (f.widthOfTextAtSize(test, fontSize) > maxWidth) {
        if (line) lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  const ensureSpace = (needed) => {
    if (y - needed < MARGIN) {
      page = pdf.addPage();
      y = page.getHeight() - MARGIN;
    }
  };

  // ── Header ────────────────────────────────────────────────────────────────
  if (name) {
    ensureSpace(28);
    page.drawText(name, { x: MARGIN, y, size: 22, font: bold, color: rgb(0.1, 0.1, 0.1) });
    y -= 26;
  }
  if (title) {
    page.drawText(title, { x: MARGIN, y, size: 13, font: bold, color: rgb(0.15, 0.4, 0.65) });
    y -= 20;
  }
  y -= 6;

  // ── Summary ───────────────────────────────────────────────────────────────
  if (summary) {
    const lines = wrapText(summary, contentWidth, font);
    ensureSpace(lines.length * (fontSize + lineGap) + 14);
    for (const line of lines) {
      page.drawText(line, { x: MARGIN, y, size: fontSize, font, color: rgb(0.2, 0.2, 0.2) });
      y -= fontSize + lineGap;
    }
    y -= 8;
  }

  // ── Skills ────────────────────────────────────────────────────────────────
  if (skills.length) {
    ensureSpace(30);
    page.drawText('SKILLS', { x: MARGIN, y, size: 11, font: bold, color: rgb(0.1, 0.1, 0.1) });
    y -= 16;
    const skillLines = wrapText(skills.join(',  '), contentWidth, font);
    for (const line of skillLines) {
      page.drawText(line, { x: MARGIN, y, size: smallSize, font, color: rgb(0.25, 0.25, 0.25) });
      y -= smallSize + lineGap;
    }
    y -= 10;
  }

  // ── Experience ────────────────────────────────────────────────────────────
  if (experience.length) {
    ensureSpace(28);
    page.drawText('PROFESSIONAL EXPERIENCE', { x: MARGIN, y, size: 11, font: bold, color: rgb(0.1, 0.1, 0.1) });
    y -= 16;
    for (const exp of experience) {
      const head = `${exp.role || ''}${exp.company ? ' — ' + exp.company : ''}`;
      const dates = exp.dates || '';
      ensureSpace(40);
      page.drawText(head, { x: MARGIN, y, size: fontSize + 1, font: bold, color: rgb(0.15, 0.15, 0.15) });
      if (dates) {
        const dw = bold.widthOfTextAtSize(dates, smallSize);
        page.drawText(dates, { x: pageWidth - MARGIN - dw, y, size: smallSize, font, color: rgb(0.4, 0.4, 0.4) });
      }
      y -= fontSize + 6;
      const points = Array.isArray(exp.points) ? exp.points : [];
      for (const pt of points) {
        const lines = wrapText(pt, contentWidth - 14, font);
        ensureSpace(lines.length * (fontSize + lineGap));
        for (const line of lines) {
          page.drawText('• ' + line, { x: MARGIN + 8, y, size: smallSize, font, color: rgb(0.25, 0.25, 0.25) });
          y -= smallSize + lineGap;
        }
        y -= 2;
      }
      y -= 6;
    }
  }

  // ── Education ─────────────────────────────────────────────────────────────
  if (education.length) {
    ensureSpace(28);
    page.drawText('EDUCATION', { x: MARGIN, y, size: 11, font: bold, color: rgb(0.1, 0.1, 0.1) });
    y -= 16;
    for (const edu of education) {
      ensureSpace(18);
      page.drawText(edu, { x: MARGIN, y, size: smallSize, font, color: rgb(0.25, 0.25, 0.25) });
      y -= smallSize + 6;
    }
    y -= 6;
  }

  // ── Certifications ────────────────────────────────────────────────────────
  if (certifications.length) {
    ensureSpace(28);
    page.drawText('CERTIFICATIONS', { x: MARGIN, y, size: 11, font: bold, color: rgb(0.1, 0.1, 0.1) });
    y -= 16;
    for (const cert of certifications) {
      ensureSpace(18);
      page.drawText(cert, { x: MARGIN, y, size: smallSize, font, color: rgb(0.25, 0.25, 0.25) });
      y -= smallSize + 6;
    }
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

module.exports = { buildResumePdf };
