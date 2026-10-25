import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';
import { detectImageType, detectDocumentType } from '../utils/imageFiles.js';
import { MAX_IMAGE_BYTES, MAX_IMAGES_PER_PROPERTY, ALLOWED_IMAGE_TYPES, MAX_VERIFICATION_DOCUMENTS, VERIFICATION_DOC_TYPES } from '../config/constants.js';

const mb = MAX_IMAGE_BYTES / 1024 / 1024;
const typeError = (name) => ApiError.validation([{ field: 'images', message: `${name}: only JPEG, PNG or WebP photos are allowed` }]);

const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_IMAGES_PER_PROPERTY, fields: 5, parts: MAX_IMAGES_PER_PROPERTY + 5 },
  fileFilter: (_req, file, cb) => (ALLOWED_IMAGE_TYPES.includes(file.mimetype) ? cb(null, true) : cb(typeError(file.originalname))),
});

function translate(err) {
  if (!(err instanceof multer.MulterError)) return err;
  if (err.code === 'LIMIT_FILE_SIZE') return new ApiError(413, `Each photo must be ${mb} MB or smaller`, { code: 'FILE_TOO_LARGE' });
  return ApiError.validation([{ field: 'images', message: `Too many photos at once (up to ${MAX_IMAGES_PER_PROPERTY}), or the wrong form field was used` }]);
}

const wrap = (handler) => (req, res, next) => handler(req, res, (err) => {
  if (err) return next(translate(err));
  const files = req.files || (req.file ? [req.file] : []);
  if (!files.length) return next(ApiError.validation([{ field: 'images', message: 'Choose at least one photo to upload' }]));
  // The declared Content-Type is client-controlled. Check the real bytes too.
  const bad = files.find((f) => detectImageType(f.buffer) === null);
  if (bad) return next(typeError(bad.originalname));
  req.files = files;
  next();
});

export const uploadImages = wrap(uploader.array('images', MAX_IMAGES_PER_PROPERTY));
export const uploadSingleImage = wrap(uploader.single('image'));

// Verification documents: photos or PDFs, 5 MB each, up to 3. The real file type is checked, as for photos.
const docError = (name) => ApiError.validation([{ field: 'documents', message: `${name}: only JPEG, PNG, WebP or PDF files are allowed` }]);
const docUploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_VERIFICATION_DOCUMENTS, fields: 5, parts: MAX_VERIFICATION_DOCUMENTS + 5 },
  fileFilter: (_req, file, cb) => (VERIFICATION_DOC_TYPES.includes(file.mimetype) ? cb(null, true) : cb(docError(file.originalname))),
});
export const uploadDocuments = (req, res, next) => docUploader.array('documents', MAX_VERIFICATION_DOCUMENTS)(req, res, (err) => {
  if (err) {
    if (err instanceof multer.MulterError) {
      return next(err.code === 'LIMIT_FILE_SIZE'
        ? new ApiError(413, `Each file must be ${mb} MB or smaller`, { code: 'FILE_TOO_LARGE' })
        : ApiError.validation([{ field: 'documents', message: `Upload up to ${MAX_VERIFICATION_DOCUMENTS} files, using the "documents" field` }]));
    }
    return next(err);
  }
  const files = req.files || [];
  if (!files.length) return next(ApiError.validation([{ field: 'documents', message: 'Attach at least one document' }]));
  const bad = files.find((f) => detectDocumentType(f.buffer) === null);
  if (bad) return next(docError(bad.originalname));
  next();
});
