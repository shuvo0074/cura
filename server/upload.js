import multer from 'multer';

const imageFilter = (_req, file, cb) => cb(null, file.mimetype.startsWith('image/'));
const limits = { fileSize: 5 * 1024 * 1024 };
const memStorage = multer.memoryStorage();

export const doctorPhotoUpload = multer({ storage: memStorage, fileFilter: imageFilter, limits });
export const hospitalPhotoUpload = multer({ storage: memStorage, fileFilter: imageFilter, limits });
export const catalogImageUpload = multer({ storage: memStorage, fileFilter: imageFilter, limits });
