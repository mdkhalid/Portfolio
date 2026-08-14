const AdmZip = require('adm-zip');

/**
 * Keyword injection for the candidate's Word (.docx) master resume.
 *
 * The docx is treated as an editable source of truth: we open the zip, edit
 * ONLY the Skills section of word/document.xml, and re-pack. New keywords are
 * inserted by cloning the candidate's existing skill paragraphs/runs, so they
 * inherit the exact font, size, bullet style, and spacing of the original.
 * Nothing else in the document is ever touched.
 */

const DOCX_ENTRY = 'word/document.xml';

// Paragraph tags do not nest in OOXML, so a non-greedy match is safe.
const PARA_RE = /<w:p(?:\s[^>]*)?\/>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;

// The heading that starts the skills section.
const SKILLS_HEADING_RE = /^(technical\s+skills|skills|core\s+(competencies|skills)|key\s+skills|technologies|technical\s+expertise|areas?\s+of\s+expertise|skill\s*set)$/i;

// Any other top-level section heading — marks where the skills section ends.
const SECTION_RE = /^(professional\s+experience|work\s+experience|experience|employment\s+history|career\s+history|education|academics?|qualifications?|certifications?|projects?|professional\s+summary|summary|profile|career\s+objective|objective|achievements?|awards?|publications?|languages?|interests?|references?|training|about\s+me)$/i;

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodeXml(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Plain text of a paragraph (all its w:t nodes concatenated). */
function textOf(paragraphXml) {
  let out = '';
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let m;
  while ((m = re.exec(paragraphXml))) out += m[1];
  return decodeXml(out).trim();
}

function splitParagraphs(xml) {
  const paras = [];
  const re = new RegExp(PARA_RE.source, 'g');
  let m;
  while ((m = re.exec(xml))) {
    paras.push({ xml: m[0], start: m.index, end: m.index + m[0].length });
  }
  return paras;
}

const styleOf = (paragraphXml) =>
  (paragraphXml.match(/<w:pStyle\s+w:val="([^"]+)"/) || [])[1] || '';

/** rPr (run properties) of the first run that contains visible text. */
function firstTextRunRpr(paragraphXml) {
  const runMatch = paragraphXml.match(/<w:r(?:\s[^>]*)?>(?=[\s\S]*?<w:t(?:\s[^>]*)?>)[\s\S]*?<\/w:r>/);
  if (!runMatch) return '';
  return (runMatch[0].match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [''])[0];
}

/** rPr of the LAST run that contains visible text (used for comma appends). */
function lastTextRunRpr(paragraphXml) {
  const runs = [...paragraphXml.matchAll(/<w:r(?:\s[^>]*)?>(?=[\s\S]*?<w:t(?:\s[^>]*)?>)[\s\S]*?<\/w:r>/g)];
  if (!runs.length) return '';
  return (runs[runs.length - 1][0].match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [''])[0];
}

/** Clone a skill paragraph's structure (bullets/spacing/style) with new text. */
function buildParagraph(templateXml, text) {
  const ppr = (templateXml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [''])[0];
  const rpr = firstTextRunRpr(templateXml);
  return `<w:p>${ppr}<w:r>${rpr}<w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
}

/**
 * Extract plain text from a .docx buffer (paragraph per line).
 * @param {Buffer} buffer
 * @returns {string}
 */
function extractDocxText(buffer) {
  try {
    const zip = new AdmZip(buffer);
    const entry = zip.getEntry(DOCX_ENTRY);
    if (!entry) return '';
    const xml = entry.getData().toString('utf8');
    return splitParagraphs(xml)
      .map((p) => textOf(p.xml))
      .filter(Boolean)
      .join('\n');
  } catch (err) {
    console.error('[resumeDocx] text extraction failed:', err?.message || err);
    return '';
  }
}

/**
 * Insert JD keywords into the existing Skills section of a .docx resume.
 *
 * - Bullet/list style → one cloned paragraph per keyword, appended to the list.
 * - Single comma paragraph → keywords appended as runs with matching formatting.
 * - Keywords already present anywhere in the document are skipped.
 *
 * @param {Buffer} docxBuffer - original .docx bytes (never modified in place)
 * @param {string[]} keywords - candidate keywords (max 8 used)
 * @returns {{ ok: boolean, buffer?: Buffer, inserted?: string[], reason?: string }}
 */
function injectKeywordsIntoDocx(docxBuffer, keywords = []) {
  try {
    const wanted = [...new Set(keywords.map((k) => String(k || '').trim()).filter(Boolean))].slice(0, 8);
    if (!wanted.length) return { ok: true, buffer: docxBuffer, inserted: [] };

    const zip = new AdmZip(docxBuffer);
    const entry = zip.getEntry(DOCX_ENTRY);
    if (!entry) return { ok: false, reason: 'no document.xml' };
    const xml = entry.getData().toString('utf8');

    const paras = splitParagraphs(xml);
    const texts = paras.map((p) => textOf(p.xml));

    // ── Locate the Skills heading ──────────────────────────────────────────
    const headIdx = texts.findIndex((t) => SKILLS_HEADING_RE.test(t));
    if (headIdx === -1) return { ok: false, reason: 'skills section not found' };
    const headStyle = styleOf(paras[headIdx].xml);

    // ── Collect the section's content paragraphs up to the next heading ────
    const content = [];
    for (let i = headIdx + 1; i < paras.length; i++) {
      const t = texts[i];
      const style = styleOf(paras[i].xml);
      const isNextHeading =
        (t && headStyle && style === headStyle) || SECTION_RE.test(t);
      if (isNextHeading) break;
      if (t) content.push(i);
    }
    if (!content.length) return { ok: false, reason: 'skills section is empty' };

    // ── Skip keywords already present anywhere in the document ─────────────
    const docLower = texts.join(' ').toLowerCase();
    const missing = wanted.filter((kw) => !docLower.includes(kw.toLowerCase()));
    if (!missing.length) return { ok: true, buffer: docxBuffer, inserted: [] };

    // ── Decide layout mode and build the insertion XML ─────────────────────
    const bulletIdx = content.filter((i) => paras[i].xml.includes('<w:numPr'));
    let newXml = '';
    let insertAt = -1;

    if (bulletIdx.length || content.length > 1) {
      // Bullet list or one-skill-per-line: clone existing skill paragraphs.
      const templateIdx = bulletIdx.length ? bulletIdx[bulletIdx.length - 1] : content[content.length - 1];
      const template = paras[templateIdx].xml;
      newXml = missing.map((kw) => buildParagraph(template, kw)).join('');
      insertAt = paras[content[content.length - 1]].end;
    } else {
      // Single comma-separated paragraph: append runs with matching formatting.
      const para = paras[content[0]];
      const rpr = lastTextRunRpr(para.xml) || firstTextRunRpr(para.xml);
      const addition = `<w:r>${rpr}<w:t xml:space="preserve">, ${escapeXml(missing.join(', '))}</w:t></w:r>`;
      const closeTag = '</w:p>';
      const closePos = para.xml.lastIndexOf(closeTag);
      if (closePos === -1) return { ok: false, reason: 'unexpected paragraph shape' };
      const updated = para.xml.slice(0, closePos) + addition + para.xml.slice(closePos);
      newXml = updated;
      // Replace the paragraph in place instead of inserting after it.
      const nextXml = xml.slice(0, para.start) + updated + xml.slice(para.end);
      zip.updateFile(DOCX_ENTRY, Buffer.from(nextXml, 'utf8'));
      return { ok: true, buffer: Buffer.from(zip.toBuffer()), inserted: missing };
    }

    const nextXml = xml.slice(0, insertAt) + newXml + xml.slice(insertAt);
    zip.updateFile(DOCX_ENTRY, Buffer.from(nextXml, 'utf8'));
    return { ok: true, buffer: Buffer.from(zip.toBuffer()), inserted: missing };
  } catch (err) {
    console.error('[resumeDocx] keyword injection failed:', err?.message || err);
    return { ok: false, reason: err?.message || 'injection error' };
  }
}

module.exports = { extractDocxText, injectKeywordsIntoDocx };
