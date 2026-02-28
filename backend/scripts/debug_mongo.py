from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

uri = os.getenv("MONGODB_URI")
db_name = os.getenv("MONGODB_DB")
coll_name = os.getenv("MONGODB_JCFPM_COLLECTION")

print(f"Connecting to: {uri.split('@')[-1] if uri else 'None'}")
print(f"Database: {db_name}")
print(f"Collection from ENV: {coll_name}")

try:
    client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    
    # List databases
    dbs = client.list_database_names()
    print(f"Available databases: {dbs}")
    
    db = client[db_name]
    
    # Check connection
    client.admin.command('ping')
    print("✅ MongoDB connection successful!")
    
    # List collections
    collections = db.list_collection_names()
    print(f"Available collections: {collections}")
    
    if coll_name in collections:
        count = db[coll_name].count_documents({})
        print(f"✅ Collection '{coll_name}' found with {count} documents.")
        
        # Breakdown by version
        versions = db[coll_name].aggregate([
            {"$group": {"_id": "$version", "count": {"$sum": 1}}}
        ])
        print("Versions:")
        for v in versions:
            print(f"  - {v}")
            
        # Breakdown by dimension
        dimensions = db[coll_name].aggregate([
            {"$group": {"_id": "$dimension", "count": {"$sum": 1}}}
        ])
        print("Dimensions:")
        for d in dimensions:
            print(f"  - {d}")
            
        doc = db[coll_name].find_one()
        print(f"Sample Document ID: {doc.get('id')} - Pool Key: {doc.get('pool_key')}")
    else:
        print(f"❌ Collection '{coll_name}' NOT found in database '{db_name}'.")
        
    if 'jcfpm_items' in collections:
        count = db['jcfpm_items'].count_documents({})
        print(f"ℹ️ Found 'jcfpm_items' with {count} documents. Maybe this is the correct one?")

except Exception as e:
    print(f"❌ MongoDB Error: {e}")
