import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

const FAQS = [
  {
    q: 'Is Cura a real hospital network?',
    a: 'No — Cura is a demo/dummy health platform. Doctors, hospitals, and appointments shown here are for demonstration purposes only, not real medical providers.',
  },
  {
    q: 'How do I log in as a patient?',
    a: 'Enter your phone number and request an OTP. Since this is a demo build, no real SMS is sent — the OTP is shown directly on screen so you can verify instantly.',
  },
  {
    q: 'Can I actually book an appointment?',
    a: 'Yes — appointment booking is fully functional. Pick a doctor, choose an available day and time slot, and confirm. You can view or cancel it anytime from "My Appointments".',
  },
  {
    q: 'What can doctors and admins do?',
    a: 'Doctors can log in to view and complete their own appointments. Admins can manage the doctor and hospital directory and view all appointments platform-wide.',
  },
];

export default function FaqAccordion() {
  const [open, setOpen] = useState(0);

  return (
    <section>
      <h2 className="text-xl font-bold text-gray-800 mb-4">Frequently Asked Questions</h2>
      <div className="flex flex-col gap-2 max-w-3xl">
        {FAQS.map((item, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? -1 : i)}
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left">
              <span className="font-medium text-gray-800 text-sm">{item.q}</span>
              {open === i ? <Minus size={16} className="text-primary flex-shrink-0" /> : <Plus size={16} className="text-primary flex-shrink-0" />}
            </button>
            {open === i && (
              <p className="px-5 pb-4 text-sm text-gray-500 leading-relaxed">{item.a}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
