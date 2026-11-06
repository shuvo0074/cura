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

/** Printout sections, each named by `settings.printouts.section.<key>`. */
export const SECTIONS = ['vitals', 'complaints', 'diagnosis', 'prescription', 'investigations', 'advice'] as const;
export const isSection = (value: string): value is (typeof SECTIONS)[number] =>
  (SECTIONS as readonly string[]).includes(value);

// -- Emails -----------------------------------------------------------------

export interface EmailBlock {
  section: string;
  title: string | null;
  leftText: string | null;
  rightText: string | null;
  includeLogo: boolean;
}
