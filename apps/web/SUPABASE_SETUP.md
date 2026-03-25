# Supabase Integration Guide

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in with your account
3. Click "New Project"
4. Fill in the project name, database password, and region
5. Click "Create new project"

### 2. Get Your Credentials

1. Go to your project's Settings → API
2. Copy the following values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. Configure Environment Variables

Add your credentials to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Setup Authentication

#### Enable Sign-Up/Sign-In

1. Go to Authentication → Providers
2. Keep Email enabled (default)
3. Configure email settings if needed
4. Go to Authentication → URL Configuration
5. Add your domain to "Redirect URLs" (e.g., `http://localhost:3000/auth/callback`)

#### Create Auth Table (Optional)

```sql
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" 
  ON public.profiles 
  FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON public.profiles 
  FOR UPDATE 
  USING (auth.uid() = id);
```

### 5. Setup Storage

1. Go to Storage → Buckets
2. Click "New Bucket"
3. Name it (e.g., `avatars`, `documents`, `images`)
4. Set visibility (Public or Private)
5. Click "Create" bucket

#### Configure Storage Policies

For public buckets:

```sql
CREATE POLICY "Public Access"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'your-bucket-name');
```

For private buckets:

```sql
CREATE POLICY "Authenticated users can upload"
  ON storage.objects
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND bucket_id = 'your-bucket-name');

CREATE POLICY "Users can access own files"
  ON storage.objects
  FOR SELECT
  USING (auth.role() = 'authenticated' AND bucket_id = 'your-bucket-name' AND owner_id = auth.uid());
```

## Usage Examples

### Login Component

```tsx
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return <LoginForm />;
}
```

### Sign Up Component

```tsx
import { SignUpForm } from "@/components/SignUpForm";

export default function SignUpPage() {
  return <SignUpForm />;
}
```

### File Upload Component

```tsx
import { FileUpload } from "@/components/FileUpload";

export default function UploadPage() {
  const handleUploadSuccess = (url: string, filename: string) => {
    console.log("File uploaded:", { url, filename });
  };

  return (
    <FileUpload
      bucketName="avatars"
      onUploadSuccess={handleUploadSuccess}
    />
  );
}
```

### Using the Auth Hook

```tsx
"use client";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!user) {
    return <div>Please log in first</div>;
  }

  return (
    <div>
      <h1>Welcome, {user.email}</h1>
      <Button onClick={() => signOut()}>Sign Out</Button>
    </div>
  );
}
```

### Using the Storage Hook

```tsx
"use client";

import { useSupabaseStorage } from "@/hooks/useSupabaseStorage";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function StorageExample() {
  const { uploadFile, listFiles, getPublicUrl, loading } = useSupabaseStorage("avatars");
  const [files, setFiles] = useState<any[]>([]);

  const handleListFiles = async () => {
    const result = await listFiles();
    setFiles(result || []);
  };

  return (
    <div className="space-y-4">
      <Button onClick={handleListFiles} disabled={loading}>
        List Files
      </Button>
      <ul>
        {files.map((file) => (
          <li key={file.name}>
            <a
              href={getPublicUrl(file.name)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {file.name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Key Features Implemented

✅ **Authentication**
- Sign up with email/password
- Sign in with email/password
- Sign out
- Session management
- Auth state persistence

✅ **Storage**
- File upload
- File deletion
- Public/private file access
- List files in bucket
- Get public URLs

✅ **Hooks**
- `useAuth()` - For authentication operations
- `useSupabaseStorage()` - For storage operations

✅ **Components**
- `LoginForm` - Pre-built login component
- `SignUpForm` - Pre-built sign up component
- `FileUpload` - Pre-built file upload component

## Security Notes

⚠️ **Never commit `.env.local`** - Add it to `.gitignore`

⚠️ **Row-Level Security (RLS)** - Always implement RLS policies for your tables

⚠️ **Anon Key Limitations** - The `NEXT_PUBLIC_SUPABASE_ANON_KEY` should only have limited permissions

⚠️ **Service Role Key** - For server-side operations, use `SUPABASE_SERVICE_ROLE_KEY` in `.env` (never public)

## Troubleshooting

**Error: Missing environment variables**
- Make sure `.env.local` is created and contains both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Error: CORS issues**
- Go to Authentication → URL Configuration and add your domain to redirect URLs

**Error: Storage bucket not found**
- Make sure the bucket name matches exactly and the bucket exists in your Supabase project

**Error: Permission denied on storage**
- Check your storage bucket policies and RLS rules

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Supabase Storage Guide](https://supabase.com/docs/guides/storage)
