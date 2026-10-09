export default function DoctorChambersFields({ entries, hospitals, onChange }) {
  const update = (index, values) => onChange(entries.map((entry, i) => i === index ? { ...entry, ...values } : entry));
  return <fieldset className="col-span-full rounded-xl border border-gray-200 p-4 space-y-3">
    <legend className="px-2 font-semibold text-sm">Chambers at hospitals and diagnostic centres</legend>
    {entries.map((entry, index) => <div key={index} className="grid sm:grid-cols-2 gap-2 border-b pb-3">
      <label className="text-xs">Hospital or diagnostic centre
        <select className="block w-full border rounded p-2 text-sm" value={entry.hospital_id || hospitals.find(h => h.name === entry.venue)?.id || ''}
          onChange={event => { const place = hospitals.find(h => String(h.id) === event.target.value); update(index, place ? { hospital_id: place.id, venue: place.name, address: place.address || '', phone: place.hotline || '' } : { hospital_id: undefined }); }}>
          <option value="">Other venue</option>{hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </label>
      {['venue', 'time', 'address', 'phone', 'note'].map(key => <label key={key} className="text-xs capitalize">{key}<input className="block w-full border rounded p-2 text-sm" value={entry[key] || ''} onChange={event => update(index, { [key]: event.target.value, ...(key === 'venue' ? { hospital_id: undefined } : {}) })} /></label>)}
      <button type="button" className="text-sm text-red-600 min-h-11" onClick={() => onChange(entries.filter((_, i) => i !== index))}>Remove chamber</button>
    </div>)}
    <button type="button" className="text-primary text-sm font-semibold min-h-11" onClick={() => onChange([...entries, { venue: '', time: '', address: '', phone: '' }])}>Add chamber</button>
  </fieldset>;
}
