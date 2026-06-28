const axios = require("axios");

// Converts an address string into { lat, lng } using OpenStreetMap's free Nominatim API.
// No API key required. Be a good citizen: Nominatim asks for a custom User-Agent.
async function geocodeAddress(address) {
  try {
    const response = await axios.get("https://nominatim.openstreetmap.org/search", {
      params: { q: address, format: "json", limit: 1 },
      headers: { "User-Agent": "local-kart-app/1.0" }
    });

    if (!response.data || response.data.length === 0) {
      return null;
    }

    return {
      lat: parseFloat(response.data[0].lat),
      lng: parseFloat(response.data[0].lon)
    };
  } catch (error) {
    console.log("Geocoding failed:", error.message);
    return null;
  }
}

// Haversine formula - straight-line distance in km between two lat/lng points
function distanceInKm(point1, point2) {
  if (!point1 || !point2) return null;

  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371; // Earth radius in km

  const dLat = toRad(point2.lat - point1.lat);
  const dLng = toRad(point2.lng - point1.lng);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(point1.lat)) * Math.cos(toRad(point2.lat)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c * 10) / 10; // rounded to 1 decimal
}

module.exports = { geocodeAddress, distanceInKm };
