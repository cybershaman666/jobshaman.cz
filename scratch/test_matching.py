
import sys
import os

# Add the project root to sys.path
sys.path.append("/home/misha/Projekty (2)/jobshaman-new/jobshaman")

from backend.app.matching_engine.scoring import score_job, haversine_km
from backend.app.matching_engine.feature_store import extract_candidate_features, extract_job_features

def test_distance_scoring():
    # User in Popice (near Brno)
    popice_lat = 48.9167
    popice_lng = 16.6833
    
    # Job in Brno (close)
    brno_lat = 49.1951
    brno_lng = 16.6068
    
    # Job in Berlin (far)
    berlin_lat = 52.5200
    berlin_lng = 13.4050
    
    dist_brno = haversine_km(popice_lat, popice_lng, brno_lat, brno_lng)
    dist_berlin = haversine_km(popice_lat, popice_lng, berlin_lat, berlin_lng)
    
    print(f"Distance to Brno: {dist_brno:.2f} km")
    print(f"Distance to Berlin: {dist_berlin:.2f} km")
    
    candidate = {
        "job_title": "Software Engineer",
        "skills": ["Python", "React"],
        "lat": popice_lat,
        "lng": popice_lng,
        "address": "Popice, CZ"
    }
    
    job_brno = {
        "title": "Python Developer",
        "description": "Looking for Python/React dev in Brno.",
        "lat": brno_lat,
        "lng": brno_lng,
        "location": "Brno, CZ",
        "source": "scraped"
    }
    
    job_berlin = {
        "title": "Python Developer",
        "description": "Looking for Python/React dev in Berlin.",
        "lat": berlin_lat,
        "lng": berlin_lng,
        "location": "Berlin, DE",
        "source": "scraped"
    }
    
    cand_feats = extract_candidate_features(candidate)
    job_brno_feats = extract_job_features(job_brno)
    job_berlin_feats = extract_job_features(job_berlin)
    
    # High semantic similarity for both
    semantic = 0.9
    
    score_brno, _, breakdown_brno = score_job(cand_feats, job_brno_feats, semantic)
    score_berlin, _, breakdown_berlin = score_job(cand_feats, job_berlin_feats, semantic)
    
    print(f"\nBrno Score: {score_brno}")
    print(f"Brno Geo Weight: {breakdown_brno['geography_weight']}")
    
    print(f"\nBerlin Score: {score_berlin}")
    print(f"Berlin Geo Weight: {breakdown_berlin['geography_weight']}")
    
    assert score_brno > score_berlin
    print("\n✅ Test Passed: Local job ranks higher!")

if __name__ == "__main__":
    test_distance_scoring()
