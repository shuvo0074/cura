/** Types shared by the printout and email panels. */

/** Printouts (page setup + layout) and the outgoing-email header/footer. */

// -- Printouts --------------------------------------------------------------

export interface Printout {
  documentType: string;
  printerType: string;
  paperSize: string;
  orientation: string;
  marginTopMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  fontScale: number;
  showHeader: boolean;
  showFooter: boolean;
  headerHtml: string | null;
  footerHtml: string | null;
  padImageKey: string | null;
  sectionOrder: string[];
}

export const SECTIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'vitals', label: 'Vital signs' },
  { key: 'complaints', label: 'Chief complaints' },
  { key: 'diagnosis', label: 'Diagnosis' },
  { key: 'prescription', label: 'Prescription (Rx)' },
  { key: 'investigations', label: 'Investigations' },
  { key: 'advice', label: 'Advice' },
];

// -- Emails -----------------------------------------------------------------

export interface EmailBlock {
  section: string;
  title: string | null;
  leftText: string | null;
  rightText: string | null;
  includeLogo: boolean;
}
