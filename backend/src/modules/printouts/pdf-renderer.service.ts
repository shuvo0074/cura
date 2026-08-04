import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { PrintoutSettingRecord } from '../../core/ports/clinical.ports';
import type { EncounterDetail } from '../../core/ports/clinical.ports';

export interface PrescriptionContext {
  practiceName: string;
  practiceAddress: string | null;
  practiceContact: string | null;
  doctorName: string;
  doctorQualifications: string;
  bmdcNumber: string | null;
  patientName: string;
  patientCuraId: string;
  patientAgeGender: string;
  encounter: EncounterDetail;
  /** Absolute path to the scanned pad image, when one is configured. */
  padImagePath: string | null;
}

const PAPER: Record<string, [number, number]> = {
  A4: [595.28, 841.89],
  A5: [419.53, 595.28],
  LETTER: [612, 792],
};

const MM_TO_PT = 2.834_65;

/**
 * Prescription PDF rendering.
 *
 * Built with PDFKit rather than a headless browser: no Chromium dependency,
 * a few milliseconds per document instead of a few hundred, and no HTML parser
 * in the request path — which also means a malicious header/footer string
 * cannot execute anything, because nothing is ever evaluated.
 *
 * The trade-off is deliberate and worth stating: `headerHtml` / `footerHtml`
 * from the printout settings are rendered as **plain text with tags stripped**,
 * not as laid-out HTML. Rich header layout would need a browser renderer.
 */
@Injectable()
export class PdfRendererService {
  renderPrescription(
    context: PrescriptionContext,
    settings: PrintoutSettingRecord,
  ): Promise<Buffer> {
    const size = PAPER[settings.paperSize] ?? PAPER.A4!;
    const landscape = settings.orientation === 'LANDSCAPE';
    const pageSize: [number, number] = landscape ? [size[1], size[0]] : size;

    const margins = {
      top: settings.marginTopMm * MM_TO_PT,
      bottom: settings.marginBottomMm * MM_TO_PT,
      left: settings.marginLeftMm * MM_TO_PT,
      right: settings.marginRightMm * MM_TO_PT,
    };

    const doc = new PDFDocument({
      size: pageSize,
      margins,
      info: {
        Title: `Prescription — ${context.patientName}`,
        Author: context.doctorName,
        Creator: 'Cura',
      },
      // Monochrome and dot-matrix targets get no background art; the pad or
      // logo would smear and waste ribbon.
      compress: settings.printerType === 'COLOUR',
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const scale = settings.fontScale / 100;
    const font = (base: number) => Math.max(6, Math.round(base * scale));

    /**
     * Scanned pad background.
     *
     * Drawn first, full-bleed, so the clinical data lands in the pad's empty
     * areas — which is why the top margin defaults to 50mm.
     */
    if (settings.padImageKey && context.padImagePath) {
      try {
        doc.image(context.padImagePath, 0, 0, {
          width: pageSize[0],
          height: pageSize[1],
        });
      } catch {
        // A missing or corrupt pad image must not fail the prescription.
      }
    }

    // Spec: when the physical pad already carries the letterhead, the system
    // header is suppressed so nothing is printed twice.
    if (settings.showHeader) {
      this.drawHeader(doc, context, settings, font);
    }

    this.drawPatientBar(doc, context, font);

    const order = settings.sectionOrder.length > 0
      ? settings.sectionOrder
      : ['vitals', 'complaints', 'diagnosis', 'prescription', 'investigations', 'advice'];

    for (const section of order) {
      this.drawSection(doc, section, context, font);
    }

    this.drawSignature(doc, context, font);

    if (settings.showFooter) {
      this.drawFooter(doc, settings, font);
    }

    doc.end();
    return done;
  }

  // -------------------------------------------------------------------------

  private drawHeader(
    doc: PDFKit.PDFDocument,
    context: PrescriptionContext,
    settings: PrintoutSettingRecord,
    font: (n: number) => number,
  ): void {
    const custom = this.stripHtml(settings.headerHtml);

    doc.fontSize(font(16)).font('Helvetica-Bold').text(context.practiceName, { align: 'left' });

    doc.fontSize(font(9)).font('Helvetica');
    if (context.practiceAddress) doc.text(context.practiceAddress);
    if (context.practiceContact) doc.text(`Phone: ${context.practiceContact}`);
    if (custom) doc.text(custom);

    doc.moveDown(0.4);
    doc.fontSize(font(11)).font('Helvetica-Bold').text(context.doctorName);
    doc.fontSize(font(9)).font('Helvetica');
    if (context.doctorQualifications) doc.text(context.doctorQualifications);
    if (context.bmdcNumber) doc.text(`BMDC Reg. No: ${context.bmdcNumber}`);

    doc.moveDown(0.5);
    this.rule(doc);
  }

  private drawPatientBar(
    doc: PDFKit.PDFDocument,
    context: PrescriptionContext,
    font: (n: number) => number,
  ): void {
    const date = context.encounter.occurredAt.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    doc.moveDown(0.4);
    doc.fontSize(font(10)).font('Helvetica-Bold').text(context.patientName, { continued: true });
    doc
      .font('Helvetica')
      .text(`   ${context.patientAgeGender}   ID: ${context.patientCuraId}`, { align: 'left' });
    doc.fontSize(font(9)).text(`Date: ${date}`);
    doc.moveDown(0.3);
    this.rule(doc);
    doc.moveDown(0.4);
  }

  private drawSection(
    doc: PDFKit.PDFDocument,
    section: string,
    context: PrescriptionContext,
    font: (n: number) => number,
  ): void {
    const { vitals, clinicalNote, prescription } = context.encounter;

    switch (section) {
      case 'vitals': {
        if (!vitals) return;
        const parts = [
          vitals.weightKg !== null ? `Weight ${vitals.weightKg} kg` : null,
          vitals.systolic !== null && vitals.diastolic !== null
            ? `BP ${vitals.systolic}/${vitals.diastolic} mmHg`
            : null,
          vitals.pulseBpm !== null ? `Pulse ${vitals.pulseBpm}/min` : null,
          vitals.temperatureC !== null ? `Temp ${vitals.temperatureC} °C` : null,
          vitals.respiratoryRate !== null ? `Resp ${vitals.respiratoryRate}/min` : null,
        ].filter(Boolean);
        if (parts.length === 0) return;
        this.heading(doc, 'Vital Signs', font);
        doc.fontSize(font(9)).font('Helvetica').text(parts.join('   ·   '));
        doc.moveDown(0.4);
        return;
      }

      case 'complaints':
        this.list(doc, 'Chief Complaints', clinicalNote?.complaints ?? [], font);
        this.list(doc, 'Observations', clinicalNote?.observations ?? [], font);
        return;

      case 'diagnosis':
        this.list(doc, 'Diagnosis', clinicalNote?.diagnoses ?? [], font);
        return;

      case 'advice':
        this.list(doc, 'Advice', clinicalNote?.advice ?? [], font);
        if (clinicalNote?.notes) {
          this.heading(doc, 'Notes', font);
          doc.fontSize(font(9)).font('Helvetica').text(clinicalNote.notes);
          doc.moveDown(0.4);
        }
        return;

      case 'investigations':
        this.list(doc, 'Investigations', prescription?.investigations ?? [], font);
        return;

      case 'prescription': {
        const items = prescription?.items ?? [];
        if (items.length === 0) return;

        // The Rx symbol is the conventional marker; keeping it makes the
        // printed sheet read as a prescription at a glance.
        this.heading(doc, 'Rx', font, 13);

        doc.fontSize(font(9)).font('Helvetica');
        items.forEach((item, index) => {
          const name = [item.form, item.drugName, item.strength].filter(Boolean).join(' ');
          const dose = `${this.n(item.morning)} + ${this.n(item.noon)} + ${this.n(item.night)}`;
          const meal =
            item.mealRelation === 'BEFORE'
              ? 'before food'
              : item.mealRelation === 'AFTER'
                ? 'after food'
                : '';
          const duration = item.durationDays ? `— ${item.durationDays} days` : '';

          doc.font('Helvetica-Bold').text(`${index + 1}. ${name}`);
          doc
            .font('Helvetica')
            .text(`     ${dose}   ${meal} ${duration}`.replace(/\s+/g, ' ').trim());
          if (item.instruction) doc.text(`     ${item.instruction}`);
          doc.moveDown(0.2);
        });

        if (prescription?.followUpDate) {
          doc.moveDown(0.2);
          doc.font('Helvetica-Bold').text(
            `Next follow-up: ${prescription.followUpDate.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}`,
          );
        }
        doc.moveDown(0.5);
        return;
      }

      default:
        return;
    }
  }

  private drawSignature(
    doc: PDFKit.PDFDocument,
    context: PrescriptionContext,
    font: (n: number) => number,
  ): void {
    doc.moveDown(1.2);
    const x = doc.page.width - doc.page.margins.right - 160;
    doc.fontSize(font(9)).font('Helvetica');
    doc.text('______________________', x, doc.y, { width: 160, align: 'center' });
    doc.text(context.doctorName, x, doc.y, { width: 160, align: 'center' });
    if (context.bmdcNumber) {
      doc.text(`BMDC ${context.bmdcNumber}`, x, doc.y, { width: 160, align: 'center' });
    }
  }

  private drawFooter(
    doc: PDFKit.PDFDocument,
    settings: PrintoutSettingRecord,
    font: (n: number) => number,
  ): void {
    const text = this.stripHtml(settings.footerHtml);
    if (!text) return;

    const y = doc.page.height - doc.page.margins.bottom - font(9) * 2;
    doc
      .fontSize(font(8))
      .font('Helvetica')
      .fillColor('#555555')
      .text(text, doc.page.margins.left, y, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: 'center',
      })
      .fillColor('#000000');
  }

  private heading(
    doc: PDFKit.PDFDocument,
    label: string,
    font: (n: number) => number,
    size = 10,
  ): void {
    doc.fontSize(font(size)).font('Helvetica-Bold').text(label);
    doc.moveDown(0.15);
  }

  private list(
    doc: PDFKit.PDFDocument,
    label: string,
    values: readonly string[],
    font: (n: number) => number,
  ): void {
    if (values.length === 0) return;
    this.heading(doc, label, font);
    doc.fontSize(font(9)).font('Helvetica').list([...values], { bulletRadius: 1.5 });
    doc.moveDown(0.4);
  }

  private rule(doc: PDFKit.PDFDocument): void {
    doc
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .strokeColor('#999999')
      .lineWidth(0.5)
      .stroke()
      .strokeColor('#000000');
  }

  /** Trims trailing `.0` so a dose reads "1" rather than "1.00". */
  private n(value: number): string {
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
  }

  /**
   * Reduces configured HTML to plain text.
   *
   * Nothing is interpreted — tags are removed and entities decoded, so a header
   * containing markup or a script tag becomes inert text rather than anything
   * the renderer acts on.
   */
  private stripHtml(value: string | null): string {
    if (!value) return '';
    return value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
