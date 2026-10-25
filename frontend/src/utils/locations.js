// One place for supported cities. Later phases can load this from the API instead.
export const CITIES = [
  { name: 'Lahore', lat: 31.5204, lng: 74.3587 },
  { name: 'Karachi', lat: 24.8607, lng: 67.0011 },
  { name: 'Islamabad', lat: 33.6844, lng: 73.0479 },
  { name: 'Rawalpindi', lat: 33.5651, lng: 73.0169 },
  { name: 'Faisalabad', lat: 31.4504, lng: 73.135 },
];
export const cityCenter = (name) => CITIES.find((c) => c.name === name) ?? CITIES[0];
