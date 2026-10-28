import { query } from './db.js';
import { uploadBuffer, deleteObject, objectNameFromUrl } from './storage.js';
import { IMAGE_TYPES } from './upload.js';

// Only photos uploaded through Cura are ours to delete; seeded photos point
// at shared files.
function isOurUpload(objectName) {
  return objectName?.includes('doctor-upload-');
}

// Each upload gets a new name, so browsers don't keep showing the old photo.
export async function saveDoctorPhoto(doctorId, file) {
  const objectName = `doctor-photos/doctor-upload-${doctorId}-${Date.now()}${IMAGE_TYPES[file.mimetype] || '.jpg'}`;
  const photoPath = await uploadBuffer(objectName, file.buffer, file.mimetype);
  const { rows } = await query(
    `UPDATE doctors d SET photo = $1 FROM (SELECT photo FROM doctors WHERE id = $2) old
     WHERE d.id = $2 RETURNING old.photo AS previous`,
    [photoPath, doctorId]
  );
  const previous = objectNameFromUrl(rows[0]?.previous);
  if (isOurUpload(previous)) await deleteObject(previous);
  return photoPath;
}

export async function removeDoctorPhoto(doctorId) {
  const { rows } = await query(
    `UPDATE doctors d SET photo = NULL FROM (SELECT photo FROM doctors WHERE id = $1) old
     WHERE d.id = $1 RETURNING old.photo AS previous`,
    [doctorId]
  );
  if (!rows[0]) return false;
  const previous = objectNameFromUrl(rows[0].previous);
  if (isOurUpload(previous)) await deleteObject(previous);
  return true;
}
