import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs/promises';
import { logger } from '../utils/logger.js';

export class WatermarkService {
  async addWatermarkToPage(pdfBuffer, pageNumber, options) {
    try {
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pages = pdfDoc.getPages();

      if (pageNumber < 1 || pageNumber > pages.length) {
        throw new Error(`Invalid page number: ${pageNumber}`);
      }

      const page = pages[pageNumber - 1];
      const { width, height } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const watermarkText = `CONFIDENTIAL - ${options.userEmail} - ${new Date().toISOString()}`;
      const sessionText = `Session: ${options.sessionId.substring(0, 8)}...`;

      // Diagonal watermark
      const fontSize = 14;
      const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);

      page.drawText(watermarkText, {
        x: (width - textWidth) / 2,
        y: height / 2,
        size: fontSize,
        font,
        color: rgb(0.8, 0.8, 0.8),
        opacity: 0.3,
        rotate: { type: 'degrees', angle: 45 },
      });

      // Footer watermark
      page.drawText(`${options.userName} | ${options.documentTitle} | Page ${pageNumber}`, {
        x: 20,
        y: 10,
        size: 8,
        font,
        color: rgb(0.6, 0.6, 0.6),
        opacity: 0.5,
      });

      page.drawText(sessionText, {
        x: width - 200,
        y: 10,
        size: 8,
        font,
        color: rgb(0.6, 0.6, 0.6),
        opacity: 0.5,
      });

      return Buffer.from(await pdfDoc.save());
    } catch (error) {
      logger.error('Watermark error:', error);
      throw error;
    }
  }

  async extractPage(pdfPath, pageNumber) {
    try {
      const pdfBuffer = await fs.readFile(pdfPath);
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const newDoc = await PDFDocument.create();
      const [copiedPage] = await newDoc.copyPages(pdfDoc, [pageNumber - 1]);
      newDoc.addPage(copiedPage);
      return Buffer.from(await newDoc.save());
    } catch (error) {
      logger.error('Extract page error:', error);
      throw error;
    }
  }

  async getPageCount(pdfPath) {
    try {
      const pdfBuffer = await fs.readFile(pdfPath);
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      return pdfDoc.getPageCount();
    } catch (error) {
      logger.error('Get page count error:', error);
      throw error;
    }
  }
}
