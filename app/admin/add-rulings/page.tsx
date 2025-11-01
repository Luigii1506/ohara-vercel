"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/app/context/UserContext";
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Database,
  FileUp,
  AlertTriangle,
  X,
} from "lucide-react";

const AddRulings: React.FC = () => {
  const router = useRouter();
  const { role, loading: userLoading } = useUser();

  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    total: number;
    current: number;
    percentage: number;
  }>({ total: 0, current: 0, percentage: 0 });

  const [uploadResults, setUploadResults] = useState<{
    success: number;
    failed: number;
    errors: string[];
  }>({ success: 0, failed: 0, errors: [] });

  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState("");

  // Check admin permissions
  useEffect(() => {
    if (!userLoading && role !== "ADMIN") {
      router.push("/unauthorized");
    }
  }, [role, userLoading, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setUploadStatus("idle");
      setStatusMessage("");
      setUploadResults({ success: 0, failed: 0, errors: [] });
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && isValidFileType(droppedFile)) {
      setFile(droppedFile);
      setUploadStatus("idle");
      setStatusMessage("");
      setUploadResults({ success: 0, failed: 0, errors: [] });
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const isValidFileType = (file: File): boolean => {
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    return validTypes.includes(file.type);
  };

  const removeFile = () => {
    setFile(null);
    setUploadStatus("idle");
    setStatusMessage("");
    setUploadResults({ success: 0, failed: 0, errors: [] });
  };

  const handleUpload = async () => {
    if (!file) {
      setStatusMessage("Please select a file to upload");
      setUploadStatus("error");
      return;
    }

    if (!isValidFileType(file)) {
      setStatusMessage(
        "Invalid file type. Please upload an Excel or CSV file."
      );
      setUploadStatus("error");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setIsLoading(true);
      setUploadStatus("loading");
      setStatusMessage("Processing file...");
      setUploadResults({ success: 0, failed: 0, errors: [] });

      // Simulate progress for file processing
      setUploadProgress({ total: 100, current: 0, percentage: 0 });

      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev.current >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          const newCurrent = Math.min(prev.current + Math.random() * 10, 90);
          return {
            ...prev,
            current: newCurrent,
            percentage: Math.round(newCurrent),
          };
        });
      }, 200);

      const response = await fetch("/api/admin/cards/rulings", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress({ total: 100, current: 100, percentage: 100 });

      const result = await response.json();

      if (response.ok) {
        setUploadStatus("success");
        setStatusMessage("File processed successfully!");
        setUploadResults({
          success: result.processed || 1,
          failed: 0,
          errors: [],
        });
      } else {
        setUploadStatus("error");
        setStatusMessage(
          result.error || "An error occurred while processing the file"
        );
        setUploadResults({
          success: 0,
          failed: 1,
          errors: [result.error || "Unknown error"],
        });
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      setUploadStatus("error");
      setStatusMessage("Error uploading file. Please try again.");
      setUploadResults({
        success: 0,
        failed: 1,
        errors: ["Network error or server unavailable"],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setUploadStatus("idle");
    setStatusMessage("");
    setUploadResults({ success: 0, failed: 0, errors: [] });
    setUploadProgress({ total: 0, current: 0, percentage: 0 });
  };

  if (userLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto bg-gradient-to-b from-[#f2eede] to-[#e6d5b8] p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-blue-500 rounded-xl shadow-lg">
              <FileText size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                Add Card Rulings
              </h1>
              <p className="text-gray-600">
                Upload Excel or CSV files containing card rulings data
              </p>
            </div>
          </div>
        </div>

        {/* Main Upload Form */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          {/* File Upload Area */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rulings File
              </label>

              {!file ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
                >
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                    disabled={isLoading}
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-lg font-medium text-gray-900 mb-2">
                      Drop your file here or click to browse
                    </p>
                    <p className="text-sm text-gray-500">
                      Supports Excel (.xlsx, .xls) and CSV files
                    </p>
                  </label>
                </div>
              ) : (
                <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="text-blue-500" size={24} />
                      <div>
                        <p className="font-medium text-gray-900">{file.name}</p>
                        <p className="text-sm text-gray-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={removeFile}
                      disabled={isLoading}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
              )}

              <p className="mt-1 text-xs text-gray-500">
                Upload Excel or CSV files containing card rulings information
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleUpload}
                disabled={isLoading || !file}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Processing...
                  </>
                ) : (
                  <>
                    <FileUp size={20} />
                    Upload Rulings
                  </>
                )}
              </button>

              {uploadStatus !== "idle" && (
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isLoading}
                  className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {isLoading && uploadProgress.total > 0 && (
            <div className="mt-6 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Processing file...</span>
                <span>{uploadProgress.percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress.percentage}%` }}
                />
              </div>
            </div>
          )}

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`mt-6 p-4 rounded-lg flex items-start gap-3 ${
                uploadStatus === "success"
                  ? "bg-green-50 text-green-800"
                  : uploadStatus === "error"
                  ? "bg-red-50 text-red-800"
                  : "bg-blue-50 text-blue-800"
              }`}
            >
              {uploadStatus === "success" ? (
                <CheckCircle2 size={20} />
              ) : uploadStatus === "error" ? (
                <AlertCircle size={20} />
              ) : (
                <Loader2 size={20} className="animate-spin" />
              )}
              <div className="flex-1">
                <p className="font-medium">{statusMessage}</p>
                {uploadResults.errors.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-sm cursor-pointer hover:underline">
                      View errors ({uploadResults.errors.length})
                    </summary>
                    <ul className="mt-2 text-sm space-y-1">
                      {uploadResults.errors.map((error, index) => (
                        <li key={index} className="text-red-600">
                          • {error}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Upload Statistics */}
        {uploadStatus === "success" && uploadResults.success > 0 && (
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Database size={20} />
              Upload Summary
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-3xl font-bold text-green-600">
                  {uploadResults.success}
                </p>
                <p className="text-sm text-gray-600 mt-1">Rulings Processed</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-3xl font-bold text-red-600">
                  {uploadResults.failed}
                </p>
                <p className="text-sm text-gray-600 mt-1">Failed Records</p>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <div className="flex gap-3">
            <AlertTriangle
              className="text-yellow-600 flex-shrink-0"
              size={20}
            />
            <div className="space-y-2 text-sm text-gray-700">
              <p className="font-medium text-gray-800">
                File Format Guidelines:
              </p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Accepted formats: Excel (.xlsx, .xls) and CSV files</li>
                <li>Ensure your file contains valid card ruling data</li>
                <li>First row should contain column headers</li>
                <li>Maximum file size: 10MB</li>
                <li>Processing may take a few moments for large files</li>
                <li>Invalid records will be skipped and reported</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddRulings;
