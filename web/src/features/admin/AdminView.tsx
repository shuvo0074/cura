import { useState } from 'react';
import styles from '../settings/settings.module.css';
import { ADMIN_ITEMS, type AdminKey } from './admin-nav';
import type { ViewedClinic } from './sections/admin-types';
import { AmbulancesPanel } from './sections/AmbulancesPanel';
import { AppointmentsPanel } from './sections/AppointmentsPanel';
import { CatalogPanel } from './sections/CatalogPanel';
import { ClinicsPanel } from './sections/ClinicsPanel';
import { DoctorsPanel } from './sections/DoctorsPanel';
import { HomePagePanel } from './sections/HomePagePanel';
import { HospitalsPanel } from './sections/HospitalsPanel';
import { OwnersPanel } from './sections/OwnersPanel';
import { PharmaciesPanel } from './sections/PharmaciesPanel';
import { PhotoCreditsPanel } from './sections/PhotoCreditsPanel';
import { SamplePricesPanel } from './sections/SamplePricesPanel';
import { SiteTextPanel } from './sections/SiteTextPanel';
import { UsersPanel } from './sections/UsersPanel';
import { VerificationsPanel } from './sections/VerificationsPanel';

/**
 * Super admin area. It uses the same API as the Cura Website admin panel, so
 * a change made in either one shows in both.
 */
export function AdminView({ onViewClinic }: { onViewClinic: (clinic: ViewedClinic) => void }) {
  const [active, setActive] = useState<AdminKey>('users');
  let previousGroup = ADMIN_ITEMS[0]!.group;

  return (
    <div className={styles.shell}>
      <nav className={styles.subnav} aria-label="Super admin sections">
        <header className={styles.subnavHead}>
          <h1>Super admin</h1>
          <p>All of Cura</p>
        </header>
        {ADMIN_ITEMS.map((item) => {
          const startsGroup = item.group !== previousGroup;
          previousGroup = item.group;
          return (
            <button
              key={item.key}
              type="button"
              data-active={active === item.key || undefined}
              data-group-start={startsGroup || undefined}
              onClick={() => setActive(item.key)}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
      <section className={styles.panel}>
        <ActiveSection active={active} onViewClinic={onViewClinic} />
      </section>
    </div>
  );
}

function ActiveSection({
  active,
  onViewClinic,
}: {
  active: AdminKey;
  onViewClinic: (clinic: ViewedClinic) => void;
}) {
  switch (active) {
    case 'users':
      return <UsersPanel />;
    case 'owners':
      return <OwnersPanel />;
    case 'clinics':
      return <ClinicsPanel onViewClinic={onViewClinic} />;
    case 'pharmacies':
      return <PharmaciesPanel />;
    case 'verifications':
      return <VerificationsPanel />;
    case 'doctors':
      return <DoctorsPanel />;
    case 'hospitals':
      return <HospitalsPanel />;
    case 'ambulances':
      return <AmbulancesPanel />;
    case 'specialties':
      return <CatalogPanel kind="specialties" />;
    case 'symptoms':
      return <CatalogPanel kind="symptoms" />;
    case 'appointments':
      return <AppointmentsPanel />;
    case 'samplePrices':
      return <SamplePricesPanel />;
    case 'homePage':
      return <HomePagePanel />;
    case 'siteText':
      return <SiteTextPanel />;
    case 'photoCredits':
      return <PhotoCreditsPanel />;
  }
}
