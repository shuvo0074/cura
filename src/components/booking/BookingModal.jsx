import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import SlotPicker from './SlotPicker';

export default function BookingModal({ doctorId, initialDay, onClose }) {
  const modalRef = useRef(null);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return createPortal(
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" aria-hidden="true" />
      <div
        ref={modalRef}
        style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 440, maxWidth: 'calc(100vw - 32px)' }}
        className="z-50 bg-white rounded-2xl shadow-xl border border-gray-100 p-6 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-base font-semibold text-gray-800">Book Appointment</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 -mr-1">
            <X size={18} />
          </button>
        </div>
        <SlotPicker doctorId={doctorId} initialDay={initialDay} />
        <p className="text-xs text-gray-400 mt-3 text-center">
          Demo booking — Cura is not a real hospital network; this does not create a real medical appointment.
        </p>
      </div>
    </>,
    document.body
  );
}
