"""
Geocoding service for JobShaman backend
Converts job location strings to latitude/longitude coordinates
Uses Nominatim (OpenStreetMap) with rate limiting and fallback caching
"""

import requests
import time
from typing import Optional, Dict, Tuple
from dotenv import load_dotenv
import os

load_dotenv()

# Static cache for major EU cities - instant fallback (no API calls)
MAJOR_CITIES_CACHE: Dict[str, Tuple[float, float]] = {
    # Czech Republic - Major Cities and Prague districts
    'praha': (50.0755, 14.4378),
    'prague': (50.0755, 14.4378),
    # Prague districts (approximate centroids)
    'praha 1': (50.0875, 14.4208),
    'praha 2': (50.0766, 14.4378),
    'praha 3': (50.0833, 14.4514),
    'praha 4': (50.0379, 14.4506),
    'praha 5': (50.0535, 14.3977),
    'praha 6': (50.0981, 14.3899),
    'praha 7': (50.1046, 14.4502),
    'praha 8': (50.1115, 14.4741),
    'praha 9': (50.1097, 14.5022),
    'praha 10': (50.0707, 14.4924),
    # Prague neighborhoods
    'vršovice': (50.0676, 14.4632),
    'žižkov': (50.0870, 14.4500),
    'nové město': (50.0789, 14.4265),
    'karlín': (50.0922, 14.4487),
    'holešovice': (50.1076, 14.4506),
    'vysočany': (50.1092, 14.5017),
    'letná': (50.0997, 14.4242),
    'smíchov': (50.0652, 14.4087),
    'dejvice': (50.1025, 14.3897),
    'strašnice': (50.0722, 14.4972),
    'vinohrady': (50.0772, 14.4412),
    # Brno districts
    'brno': (49.1951, 16.6068),
    'brno střed': (49.1951, 16.6068),
    'brno bystrc': (49.2231, 16.5081),
    'brno královo pole': (49.2236, 16.5947),
    'brno židenice': (49.2022, 16.6406),
    'brno líšeň': (49.2106, 16.6842),
    'brno sever': (49.2267, 16.6247),
    # Ostrava districts
    'ostrava': (49.8209, 18.2625),
    'ostrava poruba': (49.8300, 18.1800),
    'ostrava jih': (49.7872, 18.2511),
    'ostrava mariánské hory': (49.8200, 18.2550),
    # Plzeň districts
    'plzen': (49.7384, 13.3736),
    'plzeň': (49.7384, 13.3736),
    'plzeň severní předměstí': (49.7570, 13.3770),
    'plzeň doubravka': (49.7575, 13.4175),
    # Bratislava districts
    'bratislava': (48.1486, 17.1077),
    'bratislava staré mesto': (48.1446, 17.1097),
    'bratislava petržalka': (48.1197, 17.1067),
    'bratislava ružinov': (48.1631, 17.1606),
    # Vienna districts
    'vienna': (48.2082, 16.3738),
    'wien': (48.2082, 16.3738),
    'wien leopoldstadt': (48.2167, 16.4000),
    'wien favoriten': (48.1722, 16.3725),
    # Berlin districts
    'berlin': (52.5200, 13.4050),
    'berlin mitte': (52.5200, 13.3889),
    'berlin kreuzberg': (52.4986, 13.4033),
    'berlin charlottenburg': (52.5167, 13.3044),
    # ...existing code...
    'mora': (49.3, 16.8),
    'moravskoslezsko': (49.8, 18.0),
    'moravský-slezský': (49.8, 18.0),
    'bohemia': (49.5, 15.0),
    'ceska republika': (49.8175, 15.4730),
    'česká republika': (49.8175, 15.4730),
    'czech republic': (49.8175, 15.4730),
    'czech': (49.8175, 15.4730),
    # Slovakia
    'bratislava': (48.1486, 17.1077),
    'kosice': (48.7164, 21.2611),
    'košice': (48.7164, 21.2611),
    'banská bystrica': (48.7372, 19.1529),
    'zilina': (49.2249, 18.7382),
    'žilina': (49.2249, 18.7382),
    # Poland
    'warsaw': (52.2297, 21.0122),
    'warsawa': (52.2297, 21.0122),
    'krakow': (50.0647, 19.9450),
    'kraków': (50.0647, 19.9450),
    'wroclaw': (51.1079, 17.0385),
    'wrocław': (51.1079, 17.0385),
    'poznan': (52.4082, 16.9454),
    'poznań': (52.4082, 16.9454),
    'gdansk': (54.3520, 18.6466),
    'gdańsk': (54.3520, 18.6466),
    # Austria
    'vienna': (48.2082, 16.3738),
    'wien': (48.2082, 16.3738),
    'salzburg': (47.8095, 13.0550),
    'innsbruck': (47.2625, 11.4045),
    'graz': (47.0707, 15.4395),
    # Germany
    'berlin': (52.5200, 13.4050),
    'munich': (48.1351, 11.5820),
    'münchen': (48.1351, 11.5820),
    'hamburg': (53.5511, 9.9937),
    'cologne': (50.9375, 6.9603),
    'köln': (50.9375, 6.9603),
    'frankfurt': (50.1109, 8.6821),
    'düsseldorf': (51.2277, 6.7735),
    'dusseldorf': (51.2277, 6.7735),
    'stuttgart': (48.7758, 9.1829),
    'dortmund': (51.5136, 7.4653),
    'essen': (51.4556, 7.0116),
}

# Rate limiting for Nominatim API (1 request per second)
_last_api_call_time = 0
_call_count_per_minute = 0


def normalize_address(address: str) -> str:
    """
    Normalize address for cache lookup and API queries
    Removes diacritics, converts to lowercase, removes special chars
    """
    if not address:
        return ""
    
    # Convert to lowercase
    normalized = address.lower()
    
    # Remove common Czech/Slovak diacritics
    diacritic_map = {
        'á': 'a', 'ä': 'a', 'à': 'a', 'â': 'a',
        'é': 'e', 'ë': 'e', 'è': 'e', 'ê': 'e',
        'í': 'i', 'ï': 'i', 'ì': 'i', 'î': 'i',
        'ó': 'o', 'ö': 'o', 'ò': 'o', 'ô': 'o',
        'ú': 'u', 'ü': 'u', 'ù': 'u', 'û': 'u',
        'ý': 'y', 'ÿ': 'y',
        'ň': 'n', 'č': 'c', 'š': 's', 'ž': 'z',
        'ř': 'r', 'ů': 'u', 'ě': 'e', 'ů': 'u',
    }
    
    for char, replacement in diacritic_map.items():
        normalized = normalized.replace(char, replacement)
    
    # Remove special characters, keep only alphanumeric and spaces
    normalized = ''.join(c if c.isalnum() or c.isspace() else '' for c in normalized)
    
    # Remove extra whitespace
    normalized = ' '.join(normalized.split())
    
    return normalized.strip()


def geocode_location(location: str) -> Optional[Dict]:
    """
    Geocode a location string to latitude/longitude
    
    Returns:
        Dict with 'lat', 'lon', 'country' keys, or None if not found
    """
    if not location or not location.strip():
        return None
    
    normalized = normalize_address(location)
    
    # 1. Check static cache for exact match (districts/neighborhoods first)
    if normalized in MAJOR_CITIES_CACHE:
        lat, lon = MAJOR_CITIES_CACHE[normalized]
        return {
            'lat': lat,
            'lon': lon,
            'country': 'CZ' if lat > 47 and lat < 51.5 and lon > 12 and lon < 19 else 'EU',
            'source': 'static_cache'
        }

    # 2. Try to match any district/neighborhood in the normalized string (longest keys first)
    cache_keys = sorted(MAJOR_CITIES_CACHE.keys(), key=len, reverse=True)
    for key in cache_keys:
        if key in normalized:
            lat, lon = MAJOR_CITIES_CACHE[key]
            return {
                'lat': lat,
                'lon': lon,
                'country': 'CZ' if lat > 47 and lat < 51.5 and lon > 12 and lon < 19 else 'EU',
                'source': 'static_cache_partial'
            }
    
    # 3. Try Nominatim API for unknown locations
    return _geocode_with_nominatim(location)


def _geocode_with_nominatim(address: str) -> Optional[Dict]:
    """
    Call Nominatim OpenStreetMap API with rate limiting
    """
    global _last_api_call_time, _call_count_per_minute
    
    # Rate limiting: 1 request per second for Nominatim
    now = time.time()
    time_since_last = now - _last_api_call_time
    
    if time_since_last < 1.0:
        time.sleep(1.0 - time_since_last)
    
    _last_api_call_time = time.time()
    _call_count_per_minute += 1
    
    try:
        # Nominatim requires a User-Agent
        headers = {
            'User-Agent': 'JobShaman/1.0 (+https://jobshaman.cz)',
            'Accept-Language': 'cs,en'
        }
        
        params = {
            'q': address,
            'format': 'json',
            'countrycodes': 'cz,sk,pl,de,at',  # Focus on EU countries
            'limit': 1,
            'addressdetails': 1,
        }
        
        response = requests.get(
            'https://nominatim.openstreetmap.org/search',
            params=params,
            headers=headers,
            timeout=10
        )
        
        if response.status_code != 200:
            print(f"⚠️ Nominatim returned {response.status_code} for '{address}'")
            return None
        
        data = response.json()
        
        if data and len(data) > 0:
            result = data[0]
            return {
                'lat': float(result['lat']),
                'lon': float(result['lon']),
                'country': result.get('address', {}).get('country_code', 'UNKNOWN').upper(),
                'source': 'nominatim_api'
            }
    
    except requests.exceptions.Timeout:
        print(f"⚠️ Nominatim request timeout for '{address}'")
    except requests.exceptions.RequestException as e:
        print(f"⚠️ Nominatim request failed for '{address}': {e}")
    except Exception as e:
        print(f"⚠️ Geocoding error for '{address}': {e}")
    
    return None


def get_coordinates(location: str) -> Optional[Tuple[float, float]]:
    """
    Simple helper to get just lat, lon tuple (for compatibility)
    """
    result = geocode_location(location)
    if result:
        return (result['lat'], result['lon'])
    return None


# Example usage:
if __name__ == '__main__':
    test_locations = [
        'Brno',
        'Brno, South Moravia, Czech Republic',
        'Prague',
        'Prague, Czech Republic',
        'Unknown Town, CZ',
        'Berlin, Germany',
        'Vienna, Austria',
    ]
    
    for loc in test_locations:
        result = geocode_location(loc)
        if result:
            print(f"✅ {loc:40} -> ({result['lat']:.4f}, {result['lon']:.4f}) from {result['source']}")
        else:
            print(f"❌ {loc:40} -> NOT FOUND")
