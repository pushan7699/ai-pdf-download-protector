import { body, validationResult } from 'express-validator';

/**
 * Validation middleware wrapper
 */
export const validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({
        field: err.type === 'field' ? err.path : 'unknown',
        message: err.msg,
      })),
    });
  };
};

/**
 * Common validation rules
 */
export const ValidationRules = {
  // User validation
  email: () => body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),

  password: () => body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),

  fullName: () => body('full_name')
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Full name must be between 2 and 255 characters'),

  // Document validation
  documentTitle: () => body('title')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Document title is required and must be less than 255 characters'),

  documentDescription: () => body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must be less than 2000 characters'),

  // UUID validation
  uuid: (field) => body(field)
    .isUUID()
    .withMessage(`${field} must be a valid UUID`),

  // Session validation
  sessionToken: () => body('session_token')
    .isString()
    .notEmpty()
    .withMessage('Session token is required'),

  // Page number validation
  pageNumber: () => body('page_number')
    .isInt({ min: 1 })
    .withMessage('Page number must be a positive integer'),
};

/**
 * Sanitize input to prevent XSS
 */
export const sanitizeInput = (input)=> {
  if (!input) return '';
  
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .trim();
};

/**
 * Validate file upload
 */
export const validateFileUpload = (file) => {
  if (!file) {
    return { valid: false, error: 'No file uploaded' };
  }

  // Check file type
  const allowedMimeTypes = ['application/pdf'];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return { valid: false, error: 'Only PDF files are allowed' };
  }

  // Check file size (50MB max)
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 50MB' };
  }

  // Check file extension
  if (!file.originalname.toLowerCase().endsWith('.pdf')) {
    return { valid: false, error: 'File must have .pdf extension' };
  }

  return { valid: true };
};
