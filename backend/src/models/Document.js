import { db } from '../config/database.js';

export class DocumentModel {
  static async create(title, filename, filePath, fileSize, mimeType, pageCount, uploadedBy, description) {
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO documents (id, title, description, filename, file_path, file_size, mime_type, page_count, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, description || null, filename, filePath, fileSize, mimeType, pageCount, uploadedBy]
    );
    return await this.findById(id);
  }

  static async findById(id) {
    const { rows } = await db.query(
      'SELECT * FROM documents WHERE id = ? AND is_deleted = 0',
      [id]
    );
    return rows[0] || null;
  }

  static async findByUploader(uploadedBy, limit = 50, offset = 0) {
    const { rows } = await db.query(
      'SELECT * FROM documents WHERE uploaded_by = ? AND is_deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [uploadedBy, limit, offset]
    );
    return rows;
  }

  static async getAll(limit = 50, offset = 0) {
    const { rows } = await db.query(
      'SELECT * FROM documents WHERE is_deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    return rows;
  }

  static async update(id, updates) {
    const fields = [];
    const values = [];

    if (updates.title !== undefined)       { fields.push('title = ?');       values.push(updates.title); }
    if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
    if (fields.length === 0) return this.findById(id);

    values.push(id);
    await db.query(
      `UPDATE documents SET ${fields.join(', ')} WHERE id = ? AND is_deleted = 0`,
      values
    );
    return await this.findById(id);
  }

  static async softDelete(id) {
    await db.query(
      'UPDATE documents SET is_deleted = 1, deleted_at = NOW() WHERE id = ?',
      [id]
    );
  }

  static async delete(id) {
    await db.query('DELETE FROM documents WHERE id = ?', [id]);
  }

  static async search(query, limit = 50, offset = 0) {
    const like = `%${query}%`;
    const { rows } = await db.query(
      `SELECT * FROM documents
       WHERE is_deleted = 0 AND (title LIKE ? OR description LIKE ?)
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [like, like, limit, offset]
    );
    return rows;
  }
}
