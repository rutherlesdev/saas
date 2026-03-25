"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export function useSupabaseStorage(bucketName: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = async (file: File, path: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });
      if (error) throw error;
      return data;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Upload failed";
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteFile = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.storage.from(bucketName).remove([path]);
      if (error) throw error;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Delete failed";
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
    return data.publicUrl;
  };

  const listFiles = async (path = "") => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .list(path);
      if (error) throw error;
      return data;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "List failed";
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    uploadFile,
    deleteFile,
    getPublicUrl,
    listFiles,
    loading,
    error,
  };
}
