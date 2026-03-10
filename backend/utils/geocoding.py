import httpx
from config import settings
from typing import Tuple


async def geocode_address(address: str) -> Tuple[float, float]:
    """
    Geocode an address string to (lat, lng) using Google Maps API.
    Returns (0.0, 0.0) if geocoding fails or API key is missing.
    """
    if not address or not settings.GOOGLE_MAPS_API_KEY:
        return 0.0, 0.0

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params={
                    "address": address,
                    "key": settings.GOOGLE_MAPS_API_KEY
                },
                timeout=10.0
            )

            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "OK" and data.get("results"):
                    location = data["results"][0]["geometry"]["location"]
                    return location["lat"], location["lng"]

            print(f"Geocoding failed for '{address}': {data.get('status')}")
            return 0.0, 0.0

    except Exception as e:
        print(f"Geocoding error: {e}")
        return 0.0, 0.0
