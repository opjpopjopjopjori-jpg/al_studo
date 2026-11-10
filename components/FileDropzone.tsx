import React, { useCallback } from 'react';
import { Upload, FileText, Loader2, Trash2, Image as ImageIcon, File as FileIcon } from 'lucide-react';
import { ParsedFile, ImageFile } from '../types';

interface FileDropzoneProps {
  label: string;
  description: string;
  files: (ParsedFile | ImageFile)[];
  onFilesAdded: (files: File[]) => void;
  onRemoveFile: (id: string) => void;
  acceptMultiple?: boolean;
  isLoading?: boolean;
  acceptImages?: boolean;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  label,
  description,
  files,
  onFilesAdded,
  onRemoveFile,
  acceptMultiple = false,
  isLoading = false,
  acceptImages = false
}) => {

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (isLoading) return;
    const droppedFiles = Array.from(e.dataTransfer.files) as File[];
    const validFiles = droppedFiles.filter(f => f.type === 'application/pdf' || f.type === 'text/plain' || f.type === 'text/html' || f.name.endsWith('.txt') || f.name.endsWith('.html') || (acceptImages && f.type.startsWith('image/')));
    if (validFiles.length > 0) {
      onFilesAdded(validFiles);
    }
  }, [onFilesAdded, isLoading, acceptImages]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && !isLoading) {
      const selectedFiles = Array.from(e.target.files) as File[];
      const validFiles = selectedFiles.filter(f => f.type === 'application/pdf' || f.type === 'text/plain' || f.type === 'text/html' || f.name.endsWith('.txt') || f.name.endsWith('.html') || (acceptImages && f.type.startsWith('image/')));
      if (validFiles.length > 0) {
        onFilesAdded(validFiles);
      }
    }
  };

  return (
    <div className="w-full">
      <div 
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`border-2 border-dashed rounded-xl p-6 transition-all duration-200 
          ${isLoading 
            ? 'opacity-50 cursor-not-allowed border-gray-300 bg-gray-50 dark:border-slate-700 dark:bg-slate-900' 
            : 'border-indigo-300 dark:border-indigo-800 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 bg-white dark:bg-slate-900'}`}
      >
        <div className="flex flex-col items-center justify-center text-center gap-3">
          <div className="bg-indigo-100 dark:bg-indigo-900/50 p-3 rounded-full text-indigo-600 dark:text-indigo-400">
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">{label}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
          </div>
          
          <label className={`mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition cursor-pointer ${isLoading ? 'pointer-events-none' : ''}`}>
            {acceptImages ? 'اختر صور (JPG/PNG)' : 'اختر ملفات (PDF/TXT)'}
            <input 
              type="file" 
              className="hidden" 
              accept={acceptImages ? "image/*" : ".pdf,.txt,.html"} 
              multiple={acceptMultiple}
              onChange={handleFileChange}
              disabled={isLoading}
            />
          </label>
        </div>
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file) => (
            <div key={file.id} className="flex items-center justify-between bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3 rounded-lg shadow-sm">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className={`${('dataUrl' in file) ? 'bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-900/50 dark:text-fuchsia-300' : ('text' in file && file.text) ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300' : 'bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-300'} p-2 rounded shrink-0`}>
                  {('dataUrl' in file) ? <ImageIcon className="w-5 h-5" /> : ('text' in file && file.text) ? <FileIcon className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{file.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{('dataUrl' in file) ? 'صورة' : ('text' in file && file.text) ? `${file.text.length} حرف` : `${file.images?.length || 0} صفحة`}</p>
                </div>
              </div>
              <button 
                onClick={() => onRemoveFile(file.id)}
                className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1"
                disabled={isLoading}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};