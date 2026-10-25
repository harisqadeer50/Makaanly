import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatPrice, formatPKR, locationLine } from '../../utils/format';
import { cloudinaryUrl } from '../../utils/images';

const pinFor = (p) => {
  const label = p.currency === 'PKR' || !p.currency ? formatPKR(p.price).replace('PKR ', '').replace(' Crore', ' Cr').replace(' Lakh', ' L') : String(p.price);
  return L.divIcon({ className: '', iconSize: [0, 0], html: `<span class="gf-pin">${label}</span>` });
};

function FitBounds({ points }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat},${p.lng}`).join('|');
  useEffect(() => {
    if (!points.length) return;
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [48, 48], maxZoom: 15 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

// Shows each result that has a map location. Hidden-address listings use approximate coordinates (rounded by the API).
export default function SearchMap({ properties }) {
  const points = properties.filter((p) => p.location?.coordinates).map((p) => ({ ...p.location.coordinates, property: p }));
  const missing = properties.length - points.length;
  return (
    <div>
      <MapContainer center={[30.3753, 69.3451]} zoom={5} scrollWheelZoom className="h-[28rem] w-full rounded-card" aria-label="Map of search results">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitBounds points={points} />
        {points.map(({ lat, lng, property: p }) => (
          <Marker key={p.id} position={[lat, lng]} icon={pinFor(p)} title={p.title}>
            <Popup>
              <div className="w-52">
                {p.images?.[0] && <img src={cloudinaryUrl(p.images[0].url, { w: 400, h: 260 })} alt={p.images[0].altText || p.title} className="mb-2 h-28 w-full rounded-md object-cover" />}
                <p className="text-base font-bold text-navy-900">{formatPrice(p)}</p>
                <Link to={`/properties/${p.slug}`} className="block font-semibold leading-snug text-navy-900 underline">{p.title}</Link>
                <p className="mt-1 text-xs text-stone-500">{locationLine(p.location)}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <p className="mt-2 text-xs text-stone-500">
        {points.length ? `Showing ${points.length} on the map.` : 'None of these results have a map location.'}
        {missing > 0 && ` ${missing} ${missing === 1 ? 'listing has' : 'listings have'} no map pin.`} Pins are approximate unless the owner shares an exact address.
      </p>
    </div>
  );
}
