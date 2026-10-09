// Public vendor list, in the shape the ambulance page has always used (`id`
// is the vendor's slug). Each type offered gets a fare: the vendor's own
// quoted range, or else the shared sample range, marked as such.
export function withFares(vendor, sampleFares) {
  const { fares: quoted, slug, id: _id, hidden: _hidden, ...rest } = vendor;
  const fares = {};
  for (const category of vendor.categories) {
    if (quoted?.[category]) fares[category] = { ...quoted[category], kind: 'quoted' };
    else if (sampleFares?.[category]) fares[category] = { ...sampleFares[category], kind: 'sample' };
  }
  return { ...rest, id: slug, fares };
}
