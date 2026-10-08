import { Baby, Bone, Ear, Eye, HeartPulse, Sparkles, Stethoscope, Venus } from 'lucide-react';

// Specialities patients in Bangladesh look for most, labelled the way people
// say them ("Medicine", "Gynae", "Child specialist") rather than the formal
// department names. `name` matches doctors.specialty; `slug` the route.
export const POPULAR_SPECIALTIES = [
  { name: 'General Physician', slug: 'general-physician', en: 'Medicine', bn: 'মেডিসিন', icon: Stethoscope },
  { name: 'Gynecology', slug: 'gynecology', en: 'Gynae & Obs', bn: 'গাইনী ও প্রসূতি', icon: Venus },
  { name: 'Pediatrics', slug: 'pediatrics', en: 'Child Specialist', bn: 'শিশু বিশেষজ্ঞ', icon: Baby },
  { name: 'Cardiology', slug: 'cardiology', en: 'Heart', bn: 'হৃদরোগ', icon: HeartPulse },
  { name: 'Dermatology', slug: 'dermatology', en: 'Skin & Hair', bn: 'চর্ম ও চুল', icon: Sparkles },
  { name: 'ENT', slug: 'ent', en: 'Ear, Nose & Throat', bn: 'নাক-কান-গলা', icon: Ear },
  { name: 'Ophthalmology', slug: 'ophthalmology', en: 'Eye', bn: 'চক্ষু', icon: Eye },
  { name: 'Orthopaedics', slug: 'orthopaedics', en: 'Bones & Joints', bn: 'হাড় ও জোড়া', icon: Bone },
];

// Everyday problems, in the words people use ("gastric", "sugar", "pressure").
export const COMMON_PROBLEMS = [
  { slug: 'fever', en: 'Fever', bn: 'জ্বর' },
  { slug: 'gerd', en: 'Gastric / acidity', bn: 'গ্যাস্ট্রিক' },
  { slug: 'diabetes', en: 'Diabetes (sugar)', bn: 'ডায়াবেটিস' },
  { slug: 'hypertension', en: 'High blood pressure', bn: 'উচ্চ রক্তচাপ' },
  { slug: 'back-pain', en: 'Back pain', bn: 'কোমর ব্যথা' },
  { slug: 'asthma', en: 'Asthma / breathing', bn: 'শ্বাসকষ্ট' },
  { slug: 'thyroid-disorders', en: 'Thyroid', bn: 'থাইরয়েড' },
  { slug: 'migraine', en: 'Migraine', bn: 'মাইগ্রেন' },
  { slug: 'kidney-stones', en: 'Kidney stones', bn: 'কিডনিতে পাথর' },
  { slug: 'pcod-pcos', en: 'PCOS', bn: 'পিসিওএস' },
];

// Each division with a photo taken there (credits: src/data/photoCredits.json).
export const DIVISIONS = [
  { name: 'Dhaka', bn: 'ঢাকা', photo: '/landing/division-dhaka.jpg', alt: 'Hatirjheel lake and skyline, Dhaka' },
  { name: 'Chattogram', bn: 'চট্টগ্রাম', photo: '/landing/division-chattogram.jpg', alt: "Foy's Lake, Chattogram" },
  { name: 'Rajshahi', bn: 'রাজশাহী', photo: '/landing/division-rajshahi.jpg', alt: 'Boats on the Padma River, Rajshahi' },
  { name: 'Khulna', bn: 'খুলনা', photo: '/landing/division-khulna.jpg', alt: 'Ships on the Rupsha River, Khulna' },
  { name: 'Sylhet', bn: 'সিলেট', photo: '/landing/division-sylhet.jpg', alt: 'Malnichora Tea Garden, Sylhet' },
  { name: 'Barishal', bn: 'বরিশাল', photo: '/landing/division-barishal.jpg', alt: 'Barishal river port launch terminal' },
  { name: 'Rangpur', bn: 'রংপুর', photo: '/landing/division-rangpur.jpg', alt: 'Tajhat Palace, Rangpur' },
  { name: 'Mymensingh', bn: 'ময়মনসিংহ', photo: '/landing/division-mymensingh.jpg', alt: 'Sunset over the Brahmaputra, Mymensingh' },
];

// Show the label in the UI language, with the other language as a hint.
export const labelFor = (item, lang) => (lang === 'bn' ? item.bn : item.en);
export const altLabelFor = (item, lang) => (lang === 'bn' ? item.en : item.bn);

export function formatNumber(n, lang) {
  return new Intl.NumberFormat(lang === 'bn' ? 'bn-BD' : 'en-US').format(n);
}
