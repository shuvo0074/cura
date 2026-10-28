/**
 * Starter drug catalogue.
 *
 * Brands common in the Bangladeshi market, so the prescription auto-suggest has
 * something realistic to match against from the first login. Seeded against the
 * practice rather than globally, which means an administrator can edit or
 * remove any of them from Settings → Drug Catalog like their own entries.
 */
export interface SeedDrug {
  name: string;
  form: string;
  strength: string;
  unit: string;
  instruction: string | null;
}

const TDS = '1+1+1 after meal';
const BD = '1+0+1 after meal';
const OD = '1+0+0 after meal';
const NOCTE = '0+0+1 after meal';

export const SEED_DRUGS: readonly SeedDrug[] = [
  // -- Analgesics & antipyretics ---------------------------------------------
  { name: 'Napa', form: 'TABLET', strength: '500', unit: 'mg', instruction: TDS },
  { name: 'Napa Extra', form: 'TABLET', strength: '500', unit: 'mg', instruction: BD },
  { name: 'Napa Extend', form: 'TABLET', strength: '665', unit: 'mg', instruction: BD },
  { name: 'Ace', form: 'TABLET', strength: '500', unit: 'mg', instruction: TDS },
  { name: 'Ace Plus', form: 'TABLET', strength: '500', unit: 'mg', instruction: BD },
  { name: 'Fast', form: 'TABLET', strength: '500', unit: 'mg', instruction: TDS },
  { name: 'Reset', form: 'SYRUP', strength: '120', unit: 'mg', instruction: '5 ml three times daily' },
  { name: 'Tufnil', form: 'TABLET', strength: '200', unit: 'mg', instruction: BD },
  { name: 'Arthrin', form: 'TABLET', strength: '75', unit: 'mg', instruction: OD },
  { name: 'Etorix', form: 'TABLET', strength: '90', unit: 'mg', instruction: OD },
  { name: 'Naprosyn', form: 'TABLET', strength: '500', unit: 'mg', instruction: BD },
  { name: 'Xenapro', form: 'TABLET', strength: '500', unit: 'mg', instruction: BD },
  { name: 'Flamex', form: 'TABLET', strength: '400', unit: 'mg', instruction: TDS },
  { name: 'Ibufen', form: 'TABLET', strength: '400', unit: 'mg', instruction: TDS },
  { name: 'Diclofen', form: 'TABLET', strength: '50', unit: 'mg', instruction: BD },
  { name: 'Ketorol', form: 'INJECTION', strength: '30', unit: 'mg', instruction: 'IM as required' },
  { name: 'Algin', form: 'TABLET', strength: '50', unit: 'mg', instruction: TDS },
  { name: 'Tramacet', form: 'CAPSULE', strength: '50', unit: 'mg', instruction: BD },

  // -- Antibiotics ------------------------------------------------------------
  { name: 'Amoxil', form: 'CAPSULE', strength: '500', unit: 'mg', instruction: TDS },
  { name: 'Moxacil', form: 'CAPSULE', strength: '500', unit: 'mg', instruction: TDS },
  { name: 'Fimoxyl', form: 'CAPSULE', strength: '250', unit: 'mg', instruction: TDS },
  { name: 'Zimax', form: 'TABLET', strength: '500', unit: 'mg', instruction: OD },
  { name: 'Azithrocin', form: 'TABLET', strength: '500', unit: 'mg', instruction: OD },
  { name: 'Cef-3', form: 'CAPSULE', strength: '200', unit: 'mg', instruction: BD },
  { name: 'Ceftrone', form: 'INJECTION', strength: '1', unit: 'g', instruction: 'IV once daily' },
  { name: 'Cefotil', form: 'TABLET', strength: '500', unit: 'mg', instruction: BD },
  { name: 'Sefotil Plus', form: 'TABLET', strength: '500', unit: 'mg', instruction: BD },
  { name: 'Cephradine', form: 'CAPSULE', strength: '500', unit: 'mg', instruction: TDS },
  { name: 'Ciprocin', form: 'TABLET', strength: '500', unit: 'mg', instruction: BD },
  { name: 'Neoceptin', form: 'TABLET', strength: '500', unit: 'mg', instruction: BD },
  { name: 'Levoflox', form: 'TABLET', strength: '500', unit: 'mg', instruction: OD },
  { name: 'Moxaclav', form: 'TABLET', strength: '625', unit: 'mg', instruction: TDS },
  { name: 'Doxicap', form: 'CAPSULE', strength: '100', unit: 'mg', instruction: BD },
  { name: 'Flagyl', form: 'TABLET', strength: '400', unit: 'mg', instruction: TDS },
  { name: 'Amodis', form: 'TABLET', strength: '400', unit: 'mg', instruction: TDS },
  { name: 'Filmet', form: 'TABLET', strength: '400', unit: 'mg', instruction: TDS },
  { name: 'Clindacin', form: 'CAPSULE', strength: '300', unit: 'mg', instruction: TDS },
  { name: 'Gentin', form: 'INJECTION', strength: '80', unit: 'mg', instruction: 'IM twice daily' },
  { name: 'Meropen', form: 'INJECTION', strength: '1', unit: 'g', instruction: 'IV eight hourly' },

  // -- Gastro -----------------------------------------------------------------
  { name: 'Seclo', form: 'CAPSULE', strength: '20', unit: 'mg', instruction: 'Before breakfast' },
  { name: 'Losectil', form: 'CAPSULE', strength: '20', unit: 'mg', instruction: 'Before breakfast' },
  { name: 'Maxpro', form: 'CAPSULE', strength: '20', unit: 'mg', instruction: 'Before breakfast' },
  { name: 'Pantonix', form: 'TABLET', strength: '20', unit: 'mg', instruction: 'Before breakfast' },
  { name: 'Sergel', form: 'CAPSULE', strength: '20', unit: 'mg', instruction: 'Before breakfast' },
  { name: 'Esonix', form: 'TABLET', strength: '20', unit: 'mg', instruction: 'Before breakfast' },
  { name: 'Rabimet', form: 'TABLET', strength: '20', unit: 'mg', instruction: 'Before breakfast' },
  { name: 'Antacid Plus', form: 'SYRUP', strength: '200', unit: 'ml', instruction: '10 ml after meal' },
  { name: 'Avomine', form: 'TABLET', strength: '25', unit: 'mg', instruction: NOCTE },
  { name: 'Emistat', form: 'TABLET', strength: '8', unit: 'mg', instruction: BD },
  { name: 'Onaseron', form: 'INJECTION', strength: '8', unit: 'mg', instruction: 'IV as required' },
  { name: 'Motigut', form: 'TABLET', strength: '10', unit: 'mg', instruction: 'Before meal three times daily' },
  { name: 'Normanil', form: 'TABLET', strength: '10', unit: 'mg', instruction: TDS },
  { name: 'Imotil', form: 'CAPSULE', strength: '2', unit: 'mg', instruction: 'After each loose motion' },
  { name: 'Orsaline-N', form: 'SACHET', strength: '20.5', unit: 'g', instruction: 'One sachet in 500 ml water' },

  // -- Respiratory & allergy ---------------------------------------------------
  { name: 'Monas', form: 'TABLET', strength: '10', unit: 'mg', instruction: NOCTE },
  { name: 'Montene', form: 'TABLET', strength: '10', unit: 'mg', instruction: NOCTE },
  { name: 'Fexo', form: 'TABLET', strength: '120', unit: 'mg', instruction: OD },
  { name: 'Alatrol', form: 'TABLET', strength: '10', unit: 'mg', instruction: NOCTE },
  { name: 'Rupatrol', form: 'TABLET', strength: '10', unit: 'mg', instruction: NOCTE },
  { name: 'Deslor', form: 'TABLET', strength: '5', unit: 'mg', instruction: NOCTE },
  { name: 'Histacin', form: 'TABLET', strength: '4', unit: 'mg', instruction: NOCTE },
  { name: 'Bexitrol F', form: 'INHALER', strength: '250', unit: 'mcg', instruction: '2 puffs twice daily' },
  { name: 'Ventolin', form: 'INHALER', strength: '100', unit: 'mcg', instruction: '2 puffs as required' },
  { name: 'Sultolin', form: 'SYRUP', strength: '2', unit: 'mg', instruction: '5 ml three times daily' },
  { name: 'Doxiva', form: 'TABLET', strength: '200', unit: 'mg', instruction: OD },
  { name: 'Tusca Plus', form: 'SYRUP', strength: '100', unit: 'ml', instruction: '10 ml three times daily' },
  { name: 'Adovas', form: 'SYRUP', strength: '100', unit: 'ml', instruction: '10 ml three times daily' },
  { name: 'Ambrox', form: 'SYRUP', strength: '100', unit: 'ml', instruction: '10 ml three times daily' },

  // -- Cardiovascular & metabolic ----------------------------------------------
  { name: 'Amlovas', form: 'TABLET', strength: '5', unit: 'mg', instruction: OD },
  { name: 'Amdocal', form: 'TABLET', strength: '5', unit: 'mg', instruction: OD },
  { name: 'Cardipin', form: 'TABLET', strength: '10', unit: 'mg', instruction: OD },
  { name: 'Bisocor', form: 'TABLET', strength: '5', unit: 'mg', instruction: OD },
  { name: 'Atenol', form: 'TABLET', strength: '50', unit: 'mg', instruction: OD },
  { name: 'Losartan', form: 'TABLET', strength: '50', unit: 'mg', instruction: OD },
  { name: 'Olmecar', form: 'TABLET', strength: '20', unit: 'mg', instruction: OD },
  { name: 'Ramipril', form: 'CAPSULE', strength: '5', unit: 'mg', instruction: OD },
  { name: 'Lasix', form: 'TABLET', strength: '40', unit: 'mg', instruction: 'Morning only' },
  { name: 'Atova', form: 'TABLET', strength: '20', unit: 'mg', instruction: NOCTE },
  { name: 'Rosuva', form: 'TABLET', strength: '10', unit: 'mg', instruction: NOCTE },
  { name: 'Ecosprin', form: 'TABLET', strength: '75', unit: 'mg', instruction: OD },
  { name: 'Clopid', form: 'TABLET', strength: '75', unit: 'mg', instruction: OD },
  { name: 'Comet', form: 'TABLET', strength: '500', unit: 'mg', instruction: BD },
  { name: 'Metfo', form: 'TABLET', strength: '850', unit: 'mg', instruction: BD },
  { name: 'Diamicron MR', form: 'TABLET', strength: '60', unit: 'mg', instruction: 'Before breakfast' },
  { name: 'Sitagliptin', form: 'TABLET', strength: '50', unit: 'mg', instruction: BD },
  { name: 'Empa', form: 'TABLET', strength: '10', unit: 'mg', instruction: OD },
  { name: 'Insulin 30/70', form: 'INJECTION', strength: '100', unit: 'IU', instruction: 'As advised' },
  { name: 'Thyrox', form: 'TABLET', strength: '50', unit: 'mcg', instruction: 'Empty stomach' },

  // -- Vitamins & supplements ---------------------------------------------------
  { name: 'Calbo-D', form: 'TABLET', strength: '500', unit: 'mg', instruction: BD },
  { name: 'Ostocal-D', form: 'TABLET', strength: '600', unit: 'mg', instruction: OD },
  { name: 'D-Rise', form: 'CAPSULE', strength: '40000', unit: 'IU', instruction: 'One weekly' },
  { name: 'Vigorex', form: 'CAPSULE', strength: '400', unit: 'mg', instruction: OD },
  { name: 'Zinc-B', form: 'SYRUP', strength: '100', unit: 'ml', instruction: '5 ml twice daily' },
  { name: 'Feroglobin', form: 'CAPSULE', strength: '150', unit: 'mg', instruction: OD },
  { name: 'Folison', form: 'TABLET', strength: '5', unit: 'mg', instruction: OD },
  { name: 'Neuro-B', form: 'TABLET', strength: '100', unit: 'mg', instruction: OD },
  { name: 'Bexicin', form: 'TABLET', strength: '100', unit: 'mg', instruction: OD },

  // -- Topical & other ----------------------------------------------------------
  { name: 'Fusidin', form: 'OINTMENT', strength: '2', unit: '%', instruction: 'Apply twice daily' },
  { name: 'Betnovate-N', form: 'OINTMENT', strength: '15', unit: 'g', instruction: 'Apply twice daily' },
  { name: 'Pevisone', form: 'OINTMENT', strength: '15', unit: 'g', instruction: 'Apply twice daily' },
  { name: 'Betadine', form: 'GARGLE', strength: '100', unit: 'ml', instruction: 'Gargle three times daily' },
  { name: 'Optimox', form: 'DROP', strength: '5', unit: 'ml', instruction: '1 drop four times daily' },
  { name: 'Antazol', form: 'DROP', strength: '10', unit: 'ml', instruction: '1 drop three times daily' },
];
