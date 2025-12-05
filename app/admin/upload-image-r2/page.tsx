"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Upload,
  Image as ImageIcon,
  Check,
  X,
  Loader2,
  AlertTriangle,
} from "lucide-react";

export default function AdminUploadImagePage() {
  const [imageUrl, setImageUrl] = useState("");
  const [customFilename, setCustomFilename] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
    r2Url?: string;
  }>({ type: null, message: "" });
  const [previewUrl, setPreviewUrl] = useState("");
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [existingFilename, setExistingFilename] = useState("");
  const [uploadMode, setUploadMode] = useState<"url" | "file">("url");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const parseUploadResponse = useCallback(async (response: Response) => {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }
    const text = await response.text();
    return { error: text || "Upload failed" };
  }, []);

  const previewSource = useMemo(() => {
    if (uploadMode === "file" && selectedFile) {
      return URL.createObjectURL(selectedFile);
    }
    return previewUrl;
  }, [uploadMode, selectedFile, previewUrl]);

  const handleUpload = async (e: React.FormEvent, forceOverwrite = false) => {
    e.preventDefault();

    if (!customFilename) {
      setUploadStatus({
        type: "error",
        message: "Please provide a filename",
      });
      return;
    }

    if (uploadMode === "url" && !imageUrl) {
      setUploadStatus({
        type: "error",
        message: "Please provide an image URL",
      });
      return;
    }

    if (uploadMode === "file" && !selectedFile) {
      setUploadStatus({
        type: "error",
        message: "Please select a file to upload",
      });
      return;
    }

    setIsUploading(true);
    setUploadStatus({ type: null, message: "" });

    try {
      let response: Response;
      if (uploadMode === "file") {
        const uploadForm = new FormData();
        uploadForm.append("file", selectedFile as File);
        uploadForm.append("filename", customFilename);
        uploadForm.append("overwrite", String(forceOverwrite));

        response = await fetch("/api/upload-image-r2-file", {
          method: "POST",
          body: uploadForm,
        });
      } else {
        response = await fetch("/api/upload-image-r2", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageUrl,
            filename: customFilename,
            overwrite: forceOverwrite,
          }),
        });
      }

      const data = await parseUploadResponse(response);

      // Check if file already exists
      if (data.exists && !forceOverwrite) {
        setExistingFilename(data.filename);
        setShowOverwriteConfirm(true);
        setIsUploading(false);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setUploadStatus({
        type: "success",
        message: `Successfully uploaded ${data.uploadedCount} variants!`,
        r2Url: data.r2Url,
      });

      // Clear form
      setImageUrl("");
      setCustomFilename("");
      setPreviewUrl("");
      setSelectedFile(null);
      setShowOverwriteConfirm(false);
    } catch (error) {
      setUploadStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Upload failed",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmOverwrite = (e: React.FormEvent) => {
    setShowOverwriteConfirm(false);
    handleUpload(e, true);
  };

  const handleCancelOverwrite = () => {
    setShowOverwriteConfirm(false);
    setIsUploading(false);
  };

  const handlePreview = () => {
    if (uploadMode === "url" && imageUrl) {
      setPreviewUrl(imageUrl);
    }
    if (uploadMode === "file" && selectedFile) {
      setPreviewUrl("");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 w-full">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center gap-3 mb-6">
            <Upload className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">
              Upload Image to R2
            </h1>
          </div>

          <p className="text-gray-600 mb-8">
            Upload an image from any URL and save it to Cloudflare R2 with a
            custom filename. The system will automatically generate 7 optimized
            sizes.
          </p>

          <form onSubmit={handleUpload} className="space-y-6">
            {/* Upload Mode */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="radio"
                  name="uploadMode"
                  value="url"
                  checked={uploadMode === "url"}
                  onChange={() => setUploadMode("url")}
                  className="text-blue-600 focus:ring-blue-500"
                />
                From URL
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="radio"
                  name="uploadMode"
                  value="file"
                  checked={uploadMode === "file"}
                  onChange={() => setUploadMode("file")}
                  className="text-blue-600 focus:ring-blue-500"
                />
                From file
              </label>
            </div>

            {/* Image URL Input */}
            {uploadMode === "url" ? (
              <div>
                <label
                  htmlFor="imageUrl"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Image URL
                </label>
                <input
                  type="url"
                  id="imageUrl"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required={uploadMode === "url"}
                />
                <button
                  type="button"
                  onClick={handlePreview}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                >
                  Preview Image
                </button>
              </div>
            ) : (
              <div>
                <label
                  htmlFor="imageFile"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Select image file
                </label>
                <input
                  type="file"
                  id="imageFile"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setSelectedFile(file);
                  }}
                  className="w-full text-sm text-gray-700 border border-gray-300 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required={uploadMode === "file"}
                />
                {selectedFile && (
                  <p className="mt-1 text-sm text-gray-500">
                    {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                  </p>
                )}
              </div>
            )}

            {/* Custom Filename Input */}
            <div>
              <label
                htmlFor="filename"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Custom Filename (without extension)
              </label>
              <input
                type="text"
                id="filename"
                value={customFilename}
                onChange={(e) => setCustomFilename(e.target.value)}
                placeholder="OP01-001 or OP01-001_alt"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                Example:{" "}
                <code className="bg-gray-100 px-2 py-0.5 rounded">
                  OP01-001
                </code>{" "}
                will create{" "}
                <code className="bg-gray-100 px-2 py-0.5 rounded">
                  OP01-001.webp
                </code>
                ,{" "}
                <code className="bg-gray-100 px-2 py-0.5 rounded">
                  OP01-001-thumb.webp
                </code>
                , etc.
              </p>
            </div>

            {/* Preview */}
            {previewSource && (
              <div className="border border-gray-200 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Preview:
                </p>
                <div className="flex justify-center bg-gray-100 rounded-lg p-4">
                  <img
                    src={previewSource}
                    alt="Preview"
                    className="max-w-full max-h-96 object-contain"
                    onError={() => {
                      setUploadStatus({
                        type: "error",
                        message: "Failed to load image. Please check the URL.",
                      });
                      setPreviewUrl("");
                    }}
                  />
                </div>
              </div>
            )}

            {/* Upload Button */}
            <button
              type="submit"
              disabled={isUploading}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Upload to R2
                </>
              )}
            </button>
          </form>

          {/* Status Messages */}
          {uploadStatus.type && (
            <div
              className={`mt-6 p-4 rounded-lg flex items-start gap-3 ${
                uploadStatus.type === "success"
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              {uploadStatus.type === "success" ? (
                <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              ) : (
                <X className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p
                  className={`font-medium ${
                    uploadStatus.type === "success"
                      ? "text-green-900"
                      : "text-red-900"
                  }`}
                >
                  {uploadStatus.message}
                </p>
                {uploadStatus.r2Url && (
                  <div className="mt-2">
                    <p className="text-sm text-green-700 font-medium mb-1">
                      R2 URL:
                    </p>
                    <code className="text-xs bg-white px-3 py-2 rounded border border-green-200 block break-all">
                      {uploadStatus.r2Url}
                    </code>
                    <p className="text-xs text-green-600 mt-2">
                      Variants created: tiny, xs, thumb, small, medium, large,
                      original
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Info Section */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <ImageIcon className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-2">How it works:</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-800">
                  <li>Paste the URL of the image you want to upload</li>
                  <li>Enter a custom filename (without extension)</li>
                  <li>Click "Upload to R2"</li>
                  <li>
                    The system will download, optimize, and create 7 sizes
                  </li>
                  <li>All variants will be uploaded to Cloudflare R2</li>
                </ol>
                <p className="mt-3 text-xs text-blue-700">
                  <strong>Tip:</strong> Use descriptive filenames like
                  "OP01-001" or "OP01-001_alt" to match your card codes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Overwrite Confirmation Modal */}
      {showOverwriteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Image Already Exists
                </h3>
                <p className="text-sm text-gray-700">
                  The image{" "}
                  <code className="bg-gray-100 px-2 py-0.5 rounded font-mono text-sm">
                    {existingFilename}
                  </code>{" "}
                  already exists in R2 storage.
                </p>
                <p className="text-sm text-gray-700 mt-2">
                  Do you want to overwrite it with the new image? This action
                  cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={handleCancelOverwrite}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmOverwrite}
                disabled={isUploading}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Overwriting...
                  </>
                ) : (
                  "Overwrite"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
