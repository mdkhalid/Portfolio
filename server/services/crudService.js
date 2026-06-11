/**
 * Generic CRUD service factory for MongoDB models.
 * Provides standard create, read, update, delete operations
 * with consistent error handling.
 */
const { AppError } = require('../middleware/errorHandler');

class CrudService {
  constructor(Model, { allowedFields = [], requiredFields = [], uniqueFields = [] } = {}) {
    this.Model = Model;
    this.allowedFields = allowedFields;
    this.requiredFields = requiredFields;
    this.uniqueFields = uniqueFields;
  }

  /**
   * Get all documents, sorted by the given field.
   */
  async getAll(sortField = 'order') {
    return this.Model.find().sort(sortField);
  }

  /**
   * Get a single document by ID.
   */
  async getById(id) {
    const doc = await this.Model.findById(id);
    if (!doc) throw new AppError('Not found', 404, 'NOT_FOUND');
    return doc;
  }

  /**
   * Create a new document with sanitized data.
   */
  async create(data) {
    const sanitized = this._sanitize(data);
    this._validateRequired(sanitized);
    await this._checkUnique(sanitized);
    return this.Model.create(sanitized);
  }

  /**
   * Update a document by ID with sanitized data.
   */
  async update(id, data, options = {}) {
    const sanitized = this._sanitize(data);
    if (Object.keys(sanitized).length === 0) {
      throw new AppError('No valid fields to update', 400, 'NO_UPDATES');
    }
    const doc = await this.Model.findByIdAndUpdate(id, sanitized, {
      new: true,
      runValidators: true,
      ...options,
    });
    if (!doc) throw new AppError('Not found', 404, 'NOT_FOUND');
    return doc;
  }

  /**
   * Delete a document by ID.
   */
  async remove(id) {
    const doc = await this.Model.findByIdAndDelete(id);
    if (!doc) throw new AppError('Not found', 404, 'NOT_FOUND');
    return doc;
  }

  /**
   * Filter an object to only allowed fields.
   */
  _sanitize(data) {
    if (this.allowedFields.length === 0) return { ...data };
    const result = {};
    for (const key of this.allowedFields) {
      if (data[key] !== undefined) {
        result[key] = data[key];
      }
    }
    return result;
  }

  /**
   * Check that required fields are present.
   */
  _validateRequired(data) {
    for (const field of this.requiredFields) {
      if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
        throw new AppError(`${field} is required`, 400, 'MISSING_FIELDS');
      }
    }
  }

  /**
   * Check uniqueness constraints.
   */
  async _checkUnique(data) {
    for (const field of this.uniqueFields) {
      if (data[field]) {
        const existing = await this.Model.findOne({ [field]: data[field] });
        if (existing) {
          throw new AppError(`${field} already exists`, 409, 'DUPLICATE');
        }
      }
    }
  }
}

module.exports = { CrudService };
