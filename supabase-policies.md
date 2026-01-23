# Supabase Setup Requirements

## RLS Policies for Storage

To fix the CV upload RLS policy error, you need to create the following policies in your Supabase dashboard:

### 1. Storage Bucket Policies

```sql
-- Allow authenticated users to upload their own CV files
CREATE POLICY "Users can upload their own CVs" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'cvs' AND 
  auth.uid()::text = split_part(name, '/', 1)
);

-- Allow authenticated users to read their own CV files
CREATE POLICY "Users can read their own CVs" ON storage.objects
FOR SELECT USING (
  bucket_id = 'cvs' AND 
  auth.uid()::text = split_part(name, '/', 1)
);

-- Allow authenticated users to update their own CV files
CREATE POLICY "Users can update their own CVs" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'cvs' AND 
  auth.uid()::text = split_part(name, '/', 1)
);

-- Allow authenticated users to delete their own CV files
CREATE POLICY "Users can delete their own CVs" ON storage.objects
FOR DELETE USING (
  bucket_id = 'cvs' AND 
  auth.uid()::text = split_part(name, '/', 1)
);
```

### 2. Table Policies

Ensure these RLS policies exist for your tables:

#### candidate_profiles table
```sql
-- Allow users to view their own profile
CREATE POLICY "Users can view own profile" ON candidate_profiles
FOR SELECT USING (auth.uid() = id);

-- Allow users to insert their own profile
CREATE POLICY "Users can insert own profile" ON candidate_profiles
FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON candidate_profiles
FOR UPDATE USING (auth.uid() = id);
```

#### assessment_results table
```sql
-- Allow users to view their own assessment results
CREATE POLICY "Users can view own assessment results" ON assessment_results
FOR SELECT USING (auth.uid() = candidate_id);

-- Allow users to create assessment results
CREATE POLICY "Users can create assessment results" ON assessment_results
FOR INSERT WITH CHECK (auth.uid() = candidate_id);
```

#### career_tracks table
```sql
-- Allow users to view their own career tracks
CREATE POLICY "Users can view own career tracks" ON career_tracks
FOR SELECT USING (auth.uid() = candidate_id);

-- Allow users to create career tracks
CREATE POLICY "Users can create career tracks" ON career_tracks
FOR INSERT WITH CHECK (auth.uid() = candidate_id);

-- Allow users to update their own career tracks
CREATE POLICY "Users can update own career tracks" ON career_tracks
FOR UPDATE USING (auth.uid() = candidate_id);
```

#### resource_reviews table
```sql
-- Allow users to view their own resource reviews
CREATE POLICY "Users can view own resource reviews" ON resource_reviews
FOR SELECT USING (auth.uid() = candidate_id);

-- Allow users to create resource reviews
CREATE POLICY "Users can create resource reviews" ON resource_reviews
FOR INSERT WITH CHECK (auth.uid() = candidate_id);

-- Allow users to update their own resource reviews
CREATE POLICY "Users can update own resource reviews" ON resource_reviews
FOR UPDATE USING (auth.uid() = candidate_id);
```

## Setup Instructions

1. Go to your Supabase dashboard
2. Navigate to Storage -> Policies
3. Click "Add Policy" and apply each of the storage policies above
4. Go to Authentication -> Policies
5. Apply the table policies to each relevant table

## Notes

- The filename structure used is `userId/cv-timestamp-filename.ext`
- RLS policies ensure users can only access their own files
- The application is designed to handle RLS failures gracefully by continuing without file upload