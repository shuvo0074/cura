import { type SettingsKey } from './settings-nav';
import { PracticePanel } from './panels/PracticePanel';
import { StaffPanel } from './panels/StaffPanel';
import {
  CalendarSettingsPanel,
  CommunicationsPanel,
  PremiumPanel,
  SecurityPanel,
} from './panels/PracticeOpsPanels';
import {
  ChartingPanel,
  ClinicalNotesPanel,
  ConsentPanel,
  DrugPanel,
  PricingPanel,
} from './panels/CatalogPanels';
import { EmailPanel, PrintoutsPanel } from './panels/OutputPanels';


export function ActivePanel({ active, practiceId }: { active: SettingsKey; practiceId: string }) {
  // Keyed so switching sub-modules remounts the panel: each holds unsaved
  // draft state, and carrying one panel's draft into the next would silently
  // submit the wrong values.
  switch (active) {
    case 'premium':
      return <PremiumPanel key={active} practiceId={practiceId} />;
    case 'practice':
      return <PracticePanel key={active} practiceId={practiceId} />;
    case 'staff':
      return <StaffPanel key={active} practiceId={practiceId} />;
    case 'calendar':
      return <CalendarSettingsPanel key={active} practiceId={practiceId} />;
    case 'communications':
      return <CommunicationsPanel key={active} practiceId={practiceId} />;
    case 'pricing':
      return <PricingPanel key={active} practiceId={practiceId} />;
    case 'consent':
      return <ConsentPanel key={active} practiceId={practiceId} />;
    case 'security':
      return <SecurityPanel key={active} practiceId={practiceId} />;
    case 'notes':
      return <ClinicalNotesPanel key={active} practiceId={practiceId} />;
    case 'drugs':
      return <DrugPanel key={active} practiceId={practiceId} />;
    case 'charting':
      return <ChartingPanel key={active} practiceId={practiceId} />;
    case 'printouts':
      return <PrintoutsPanel key={active} practiceId={practiceId} />;
    case 'email':
      return <EmailPanel key={active} practiceId={practiceId} />;
  }
}
