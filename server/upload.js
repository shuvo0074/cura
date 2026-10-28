import multer from 'multer';

// Raster formats only: an SVG can carry script, and uploads are served from
// the site's own origin (the /cura-media proxy).
export const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const imageFilter = (_req, file, cb) => cb(null, file.mimetype in IMAGE_TYPES);
const limits = { fileSize: 5 * 1024 * 1024 };
const memStorage = multer.memoryStorage();

export const doctorPhotoUpload = multer({ storage: memStorage, fileFilter: imageFilter, limits });
export const hospitalPhotoUpload = multer({ storage: memStorage, fileFilter: imageFilter, limits });
export const catalogImageUpload = multer({ storage: memStorage, fileFilter: imageFilter, limits });
