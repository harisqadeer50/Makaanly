import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// An inline SVG pin avoids Leaflet's default image assets, which break under bundlers.
const pin = L.divIcon({
  className: '',
  iconSize: [32, 40], iconAnchor: [16, 38],
  html: '<svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg"><path d="M16 0C7.2 0 0 7 0 15.7 0 27 16 40 16 40s16-13 16-24.300C32 7 24.800 0 16 0z" fill="#0f1b30"/><circle cx="16" cy="16" r="6" fill="#fff"/></svg>',
});

function Picker({ onPick }) {
  useMapEvents({ click: (e) => onPick({ lat: Number(e.latlng.lat.toFixed(6)), lng: Number(e.latlng.lng.toFixed(6)) }) });
  return null;
}

// Display mode: pass `point`. Picker mode: also pass `onPick`.
export default function LocationMap({ point, center, approximate = false, onPick, zoom = 15, className = 'h-72 w-full rounded-card' }) {
  const mid = point || center;
  return (
    <MapContainer center={[mid.lat, mid.lng]} zoom={point ? zoom : 12} scrollWheelZoom={!!onPick} className={className} key={onPick ? 'picker' : `${mid.lat},${mid.lng}`}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {onPick && <Picker onPick={onPick} />}
      {point && !approximate && <Marker position={[point.lat, point.lng]} icon={pin} />}
      {point && approximate && <Circle center={[point.lat, point.lng]} radius={600} pathOptions={{ color: '#3b674f', fillColor: '#679c7f', fillOpacity: 0.25 }} />}
    </MapContainer>
  );
}
