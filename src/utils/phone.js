// A phone number in the UI language's digits (৯৯৯ in Bangla).
export const phoneDigits = (number, lang) => (lang === 'bn' ? String(number).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]) : String(number));
