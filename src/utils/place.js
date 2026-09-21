// Appends the division to a place string: "Netrokona" -> "Netrokona, Mymensingh Division";
// when the city is the division's own HQ, "Rangpur" -> "Rangpur Division".
export function withDivision(text, city, division) {
  if (!division || !text) return text;
  if (city === division && text.endsWith(city)) return `${text} Division`;
  return `${text}, ${division} Division`;
}
