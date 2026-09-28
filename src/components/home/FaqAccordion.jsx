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
    q: 'Can I book an appointment right now?',
    a: 'Not from the doctor profile page yet — booking was paused while patient/doctor login is being rebuilt. You can see each doctor\'s weekly schedule and chamber list, then call the chamber directly to arrange a visit.',
  },
  {
    q: 'What can doctors and admins do?',
    a: 'Doctors can log in to view and complete their own appointments. Admins can manage the doctor and hospital directory and view all appointments platform-wide.',
  },
  {
    q: 'Can I search for a doctor by symptom instead of a speciality?',
    a: 'Yes — browse Symptoms from the home page or the search bar. Cura matches your symptom against each doctor\'s listed specialty, clinical expertise, and treatments; a couple of very generic symptoms may show no results yet.',
  },
  {
    q: 'Can I filter doctors and hospitals by location?',
    a: 'Yes — every doctor and hospital is assigned to one of Bangladesh\'s 8 divisions, with real cities and addresses. Use the Division and City filters on Find Doctor, Find Hospital, and any speciality or symptom page.',
  },
  {
    q: "What happens when I tap a chamber's phone number?",
    a: 'It opens your phone\'s dialer for that specific chamber. Doctors often hold hours at more than one hospital, so each chamber has its own listed number rather than one general contact.',
  },
  {
    q: 'Can I see which doctors work at a specific hospital?',
    a: "Yes — every hospital has its own page listing everyone who holds chamber hours there, including a live 'On Duty Now' badge, with a filter by speciality.",
  },
  {
    q: 'Is it safe to use my real information on Cura?',
    a: 'Cura is a demo build, not a production medical platform — please avoid entering real personal or medical details. Patient login uses a mock OTP shown directly on screen rather than a real SMS.',
  },
  {
    q: 'Why do some specialities, symptoms, or cities show no doctors?',
    a: "Cura's 500 doctors and 65 hospitals are synthetic demo data spread unevenly across Bangladesh — a handful of specialities, symptoms, and less-populated cities may currently show no matches. That's a known data-coverage gap, not a bug.",
  },
];

export default function FaqAccordion() {
  const [open, setOpen] = useState(-1);

  return (
    <section>
      <h2 className="text-2xl font-bold text-[#1a1a1a] mb-2">Frequently Asked Questions</h2>
      <p className="text-sm text-gray-500 max-w-2xl mb-4 leading-relaxed">
        Answers to the questions people ask most about how Cura works — finding doctors, patient
        login, and what doctors and admins can do on the platform.
      </p>
      <div className="flex flex-col gap-3">
        {FAQS.map((item, i) => (
          <div key={i} className="bg-white rounded-2xl border border-primary/20 overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? -1 : i)}
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left">
              <span className="font-semibold text-gray-800 text-base">{item.q}</span>
              <span className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-full border border-primary">
                {open === i ? <Minus size={16} className="text-primary" /> : <Plus size={16} className="text-primary" />}
              </span>
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
