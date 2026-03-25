"use client";

import { useState } from "react";
import { useSupabaseStorage } from "@/hooks/useSupabaseStorage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Upload, Loader2 } from "lucide-react";

interface FileUploadProps {
  bucketName: string;
  onUploadSuccess?: (url: string, filename: string) => void;
}

export function FileUpload({ bucketName, onUploadSuccess }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const { uploadFile, getPublicUrl, loading, error } = useSupabaseStorage(bucketName);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    try {
      const timestamp = Date.now();
      const filename = `${timestamp}-${file.name}`;
      
      await uploadFile(file, filename);
      
      const publicUrl = getPublicUrl(filename);
      setUploadedUrl(publicUrl);
      setFile(null);
      
      if (onUploadSuccess) {
        onUploadSuccess(publicUrl, filename);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upload File</CardTitle>
        <CardDescription>Upload files to your storage</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleUpload} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <label htmlFor="file-input" className="block text-sm font-medium">
              Select a file
            </label>
            <input
              id="file-input"
              type="file"
              onChange={handleFileChange}
              disabled={loading}
              className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-md file:border-0 file:bg-slate-200 file:px-3 file:py-2 file:text-sm file:font-semibold hover:file:bg-slate-300"
            />
            {file && (
              <p className="text-sm text-slate-600">
                Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <Button type="submit" disabled={!file || loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload File
              </>
            )}
          </Button>

          {uploadedUrl && (
            <div className="bg-green-50 p-3 rounded-md">
              <p className="text-sm text-green-800 mb-2">File uploaded successfully!</p>
              <input
                type="text"
                value={uploadedUrl}
                readOnly
                className="w-full px-2 py-1 text-xs border rounded bg-white text-green-700"
              />
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
