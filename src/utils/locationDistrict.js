export function districtAtLocation(geo, { lat, lng }) {
  const { x0, y0, scale } = geo.projection;
  const x = (lng - x0) * scale;
  const y = (y0 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))) * scale;
  return geo.districts.find(d => d.d.split('M').filter(Boolean).some(part => {
    const ring = part.replaceAll('Z', '').split('L').map(p => p.split(',').map(Number));
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }));
}
