import os
from dotenv import load_dotenv
from supabase import create_client, Client
from pymongo import MongoClient

load_dotenv()

# Supabase
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

# MongoDB
mongo_uri = os.getenv("MONGODB_URI")
mongo_db = os.getenv("MONGODB_DB")
mongo_coll = os.getenv("MONGODB_JCFPM_COLLECTION")

print("--- Supabase Sample ---")
try:
    resp = supabase.table("jcfpm_items").select("*").limit(1).execute()
    if resp.data:
        item = resp.data[0]
        print(f"ID: {item.get('id')}")
        print(f"Pool Key: {item.get('pool_key')}")
        print(f"Dimension: {item.get('dimension')}")
        print(f"Keys: {list(item.keys())}")
    else:
        print("No items in Supabase jcfpm_items")
except Exception as e:
    print(f"Supabase error: {e}")

print("\n--- MongoDB Sample ---")
try:
    client = MongoClient(mongo_uri)
    db = client[mongo_db]
    coll = db[mongo_coll]
    item = coll.find_one()
    if item:
        print(f"ID: {item.get('id')}")
        print(f"Pool Key: {item.get('pool_key')}")
        print(f"Dimension: {item.get('dimension')}")
        print(f"Keys: {list(item.keys())}")
    else:
        print("No items in MongoDB")
except Exception as e:
    print(f"MongoDB error: {e}")
