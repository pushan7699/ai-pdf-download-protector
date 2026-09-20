import { v2 as cloudinary } from 'cloudinary';
import { logger } from '../utils/logger.js';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export class CloudinaryService {
  /**
   * Upload a PDF buffer to Cloudinary
   * Returns the public_id and secure_url
   */
  async uploadPDF(buffer, filename) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',        // PDFs are 'raw' in Cloudinary
          folder: 'pdf-security',
          public_id: filename,
          overwrite: false,
          type: 'authenticated',       // private — requires signed URL to access
        },
        (error, result) => {
          if (error) {
            logger.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      uploadStream.end(buffer);
    });
  }

  /**
   * Download a PDF from Cloudinary as a Buffer
   */
  async downloadPDF(publicId) {
    try {
      // Generate a signed URL valid for 60 seconds
      const url = cloudinary.url(publicId, {
        resource_type: 'raw',
        type: 'authenticated',
        sign_url: true,
        expires_at: Math.floor(Date.now() / 1000) + 60,
      });

      const response = await fetch(url);
      if (!response.ok) throw new Error(`Cloudinary fetch failed: ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      logger.error('Cloudinary download error:', error);
      throw error;
    }
  }

  /**
   * Delete a PDF from Cloudinary
   */
  async deletePDF(publicId) {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
    } catch (error) {
      logger.error('Cloudinary delete error:', error);
    }
  }

  /**
   * Check if Cloudinary is configured
   */
  isConfigured() {
    return !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );
  }
}

export const cloudinaryService = new CloudinaryService();
