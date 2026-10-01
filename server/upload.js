import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../public');

export const doctorPhotoUpload = multer({
  storage: multer.diskStorage({
    destination: path.join(publicDir, 'doctor-photos'),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `doctor-upload-${req.params.id}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const hospitalPhotoUpload = multer({
  storage: multer.diskStorage({
    destination: path.join(publicDir, 'hospital-photos'),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `hospital-${req.params.id}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
  limits: { fileSize: 5 * 1024 * 1024 },
});
