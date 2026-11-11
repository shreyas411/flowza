import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Plus,
  Trash2,
  FileText,
  Search,
  CheckCircle,
  HelpCircle,
  Sparkles,
  X,
  Upload,
  FileUp,
  FileCode,
  FileType,
  Download,
  Eye,
  AlertCircle,
  Check,
  Filter,
  FileCheck,
} from 'lucide-react';
import { KnowledgeDocument } from '../../types/crm';
import { apiRequest } from '../../lib/api';

export const KnowledgeBaseView: React.FC = () => {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [activeTab, setActiveTab] = useState<'ALL' | 'FILES' | 'TEXT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'FILE_UPLOAD' | 'MANUAL_ENTRY'>('FILE_UPLOAD');

  // Manual entry fields
  const [title, setTitle] = useState('');
  const [sourceType, setSourceType] = useState<'FAQ' | 'POLICY' | 'TEXT' | 'URL'>('FAQ');
  const [content, setContent] = useState('');

  // File upload state
  const [selectedFiles, setSelectedFiles] = useState<{
    file: File;
    name: string;
    size: number;
    type: string;
    extractedText: string;
    dataUrl?: string;
  }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string | null>(null);

  // Preview Modal
  const [previewDoc, setPreviewDoc] = useState<KnowledgeDocument | null>(null);

  // Grounding Simulator query
  const [testQuery, setTestQuery] = useState('What is your return policy on blazers?');
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = () => {
    apiRequest<KnowledgeDocument[]>('/api/v1/knowledge')
      .then((data) => setDocuments(data))
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  // Format bytes helper
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Process uploaded files
  const processFiles = async (fileList: FileList) => {
    setUploadErrorMsg(null);
    const newFiles: {
      file: File;
      name: string;
      size: number;
      type: string;
      extractedText: string;
      dataUrl?: string;
    }[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.size > 15 * 1024 * 1024) {
        setUploadErrorMsg(`File "${file.name}" exceeds 15MB size limit.`);
        continue;
      }

      const text = await readFileAsText(file);
      const dataUrl = await readFileAsDataUrl(file);

      newFiles.push({
        file,
        name: file.name,
        size: file.size,
        type: file.type || file.name.split('.').pop() || 'unknown',
        extractedText: text,
        dataUrl,
      });
    }

    setSelectedFiles((prev) => [...prev, ...newFiles]);
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      // Check if text-based
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (
        file.type.startsWith('text/') ||
        ['txt', 'md', 'markdown', 'csv', 'json', 'yaml', 'yml'].includes(extension || '')
      ) {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) || '');
        reader.onerror = () => resolve(`Document: ${file.name} (${formatFileSize(file.size)})`);
        reader.readAsText(file);
      } else {
        // PDF / Binary document fallback representation
        resolve(
          `Document Attachment: ${file.name}\nFile Type: ${file.type || extension}\nSize: ${formatFileSize(
            file.size
          )}\nContent indexed for AI reference grounding.`
        );
      }
    });
  };

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setIsSubmitting(true);

    try {
      await apiRequest('/api/v1/knowledge', {
        method: 'POST',
        body: JSON.stringify({ title, sourceType, content }),
      });
      setIsModalOpen(false);
      setTitle('');
      setContent('');
      loadDocuments();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadSubmit = async () => {
    if (selectedFiles.length === 0) return;
    setIsSubmitting(true);
    setUploadErrorMsg(null);

    try {
      // One request per file keeps each body under the server's size limit.
      for (const [i, f] of selectedFiles.entries()) {
        try {
          await apiRequest('/api/v1/knowledge/upload', {
            method: 'POST',
            body: JSON.stringify({
              title: f.name.replace(/\.[^/.]+$/, ''), // remove extension for clean title
              content: f.extractedText,
              fileName: f.name,
              fileType: f.type,
              fileData: f.dataUrl,
            }),
          });
        } catch (err: any) {
          setSelectedFiles(selectedFiles.slice(i)); // keep the failed + remaining files so the user can retry
          loadDocuments();
          throw new Error(`"${f.name}": ${err.message}`);
        }
      }

      setUploadSuccessMsg(`Successfully uploaded ${selectedFiles.length} file(s) to Knowledge Base!`);
      setSelectedFiles([]);
      loadDocuments();
      setTimeout(() => {
        setIsModalOpen(false);
        setUploadSuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      setUploadErrorMsg(err.message || 'Failed to upload files');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this knowledge document?')) return;
    try {
      await apiRequest(`/api/v1/knowledge/${id}`, { method: 'DELETE' });
      loadDocuments();
      if (previewDoc?.id === id) setPreviewDoc(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadFile = async (doc: KnowledgeDocument) => {
    if (doc.fileKey) {
      try {
        const { url } = await apiRequest<{ url: string }>(`/api/v1/knowledge/${doc.id}/download`);
        window.location.assign(url); // signed S3 URL with attachment disposition: downloads, page stays
      } catch (err: any) {
        alert(err.message || 'Download failed');
      }
    } else {
      // Fallback create blob from content
      const blob = new Blob([doc.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName || `${doc.title}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleRunGroundingTest = async () => {
    if (!testQuery.trim()) return;
    setIsTesting(true);
    try {
      const res = await apiRequest('/api/v1/ai/suggest', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: 'conv_1',
          lastMessageText: testQuery,
        }),
      });
      setTestResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTesting(false);
    }
  };

  // Filtered documents
  const filteredDocuments = documents.filter((doc) => {
    const matchesTab =
      activeTab === 'ALL' ||
      (activeTab === 'FILES' && doc.sourceType === 'FILE') ||
      (activeTab === 'TEXT' && doc.sourceType !== 'FILE');

    const matchesSearch =
      searchQuery === '' ||
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.fileName && doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesTab && matchesSearch;
  });

  const filesCount = documents.filter((d) => d.sourceType === 'FILE').length;
  const textCount = documents.filter((d) => d.sourceType !== 'FILE').length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">AI Knowledge Base &amp; Grounding</h2>
          <p className="text-xs text-slate-500">
            Upload product manuals, return policies, PDFs, and FAQs used by the AI to ground customer replies
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Upload File Direct Action */}
          <button
            onClick={() => {
              setModalMode('FILE_UPLOAD');
              setIsModalOpen(true);
            }}
            className="px-3.5 py-1.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-600" />
            <span>Upload Files</span>
          </button>

          {/* Add Text Knowledge */}
          <button
            onClick={() => {
              setModalMode('MANUAL_ENTRY');
              setIsModalOpen(true);
            }}
            className="px-3.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Text / FAQ</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md text-xs font-medium">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1 rounded transition-colors ${
              activeTab === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Knowledge ({documents.length})
          </button>
          <button
            onClick={() => setActiveTab('FILES')}
            className={`px-3 py-1 rounded transition-colors flex items-center gap-1 ${
              activeTab === 'FILES' ? 'bg-white text-indigo-600 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3 h-3" />
            Uploaded Files ({filesCount})
          </button>
          <button
            onClick={() => setActiveTab('TEXT')}
            className={`px-3 py-1 rounded transition-colors ${
              activeTab === 'TEXT' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            FAQs &amp; Policies ({textCount})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search documents or files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50"
          />
        </div>
      </div>

      {/* Quick Drop Zone (when files tab is active or empty) */}
      {activeTab === 'FILES' && filesCount === 0 && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => {
            setModalMode('FILE_UPLOAD');
            setIsModalOpen(true);
          }}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]'
              : 'border-slate-200 hover:border-indigo-400 bg-slate-50/50'
          }`}
        >
          <div className="w-10 h-10 mx-auto rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2">
            <Upload className="w-5 h-5" />
          </div>
          <h4 className="text-xs font-semibold text-slate-800">No knowledge files uploaded yet</h4>
          <p className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto">
            Drag &amp; drop PDF policies, CSV catalogs, product manuals, or text guidelines here to index for AI reply grounding
          </p>
          <span className="inline-block mt-3 text-[11px] font-medium text-indigo-600 hover:underline">
            Click to upload files
          </span>
        </div>
      )}

      {/* Main Grid: Docs + Grounding Tester */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Documents List */}
        <div className="lg:col-span-2 space-y-3">
          {filteredDocuments.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-xs text-slate-400">
              No matching knowledge documents found.
            </div>
          ) : (
            filteredDocuments.map((doc) => {
              const isFile = doc.sourceType === 'FILE';
              const fileExt = doc.fileName ? doc.fileName.split('.').pop()?.toUpperCase() : null;

              return (
                <div
                  key={doc.id}
                  className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs hover:border-slate-300 transition-colors space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${
                          isFile
                            ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                            : 'bg-indigo-50 text-indigo-600 border border-indigo-200/50'
                        }`}
                      >
                        {isFile ? <Upload className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-semibold text-slate-900">{doc.title}</h4>
                          {fileExt && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold uppercase">
                              {fileExt}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span className="capitalize">{doc.sourceType.toLowerCase()}</span>
                          {doc.fileSize && (
                            <>
                              <span>•</span>
                              <span>{formatFileSize(doc.fileSize)}</span>
                            </>
                          )}
                          <span>•</span>
                          <span className="text-emerald-600 font-medium flex items-center gap-0.5">
                            <CheckCircle className="w-2.5 h-2.5" /> Grounded
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {isFile && (
                        <button
                          onClick={() => handleDownloadFile(doc)}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                          title="Download File"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => setPreviewDoc(doc)}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                        title="View Full Content"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                        title="Delete Document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-100 line-clamp-3">
                    {doc.content}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Live Grounding Semantic Tester */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4 self-start">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <h3 className="font-semibold text-slate-900 text-xs">Test Knowledge Grounding</h3>
          </div>
          <p className="text-xs text-slate-500">
            Simulate a customer inquiry to test how semantic retrieval finds matching documents &amp; uploaded files to draft an answer:
          </p>

          <div>
            <textarea
              rows={3}
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              placeholder="Type any customer question..."
              className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <button
            onClick={handleRunGroundingTest}
            disabled={isTesting}
            className="w-full py-1.5 rounded bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isTesting ? 'Retrieving & Generating...' : 'Run Grounding Test'}</span>
          </button>

          {testResult && (
            <div className="p-3 bg-purple-50/70 border border-purple-200/80 rounded-md text-xs space-y-2 animate-in fade-in">
              <div className="font-semibold text-purple-900 text-[11px] flex items-center justify-between">
                <span>AI Drafted Response</span>
                <span>Confidence: {Math.round(testResult.confidence * 100)}%</span>
              </div>
              <div className="bg-white p-2 rounded text-slate-800 text-[11px] font-mono leading-relaxed border border-purple-100">
                {testResult.text}
              </div>
              {testResult.citations && testResult.citations.length > 0 && (
                <div className="text-[10px] text-slate-500">
                  <span className="font-medium">Retrieved Sources: </span>
                  {testResult.citations.map((c: any) => c.title).join(', ')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add / Upload Knowledge Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-xl w-full p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-semibold text-slate-900">Add Knowledge to AI Engine</h3>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedFiles([]);
                  setUploadErrorMsg(null);
                  setUploadSuccessMsg(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <button
                onClick={() => setModalMode('FILE_UPLOAD')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  modalMode === 'FILE_UPLOAD'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Document Files</span>
              </button>
              <button
                onClick={() => setModalMode('MANUAL_ENTRY')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  modalMode === 'MANUAL_ENTRY'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Manual Text / Policy</span>
              </button>
            </div>

            {/* Notifications inside modal */}
            {uploadErrorMsg && (
              <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadErrorMsg}</span>
              </div>
            )}
            {uploadSuccessMsg && (
              <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{uploadSuccessMsg}</span>
              </div>
            )}

            {/* FILE UPLOAD MODE */}
            {modalMode === 'FILE_UPLOAD' && (
              <div className="space-y-4">
                {/* Drag and Drop Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-indigo-600 bg-indigo-50/60'
                      : 'border-slate-200 hover:border-indigo-400 bg-slate-50/50'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => {
                      if (e.target.files) processFiles(e.target.files);
                    }}
                    multiple
                    accept=".pdf,.txt,.md,.markdown,.csv,.json,.doc,.docx"
                    className="hidden"
                  />
                  <FileUp className="w-8 h-8 mx-auto text-indigo-600 mb-2" />
                  <p className="text-xs font-semibold text-slate-800">
                    Click to browse or drag and drop files here
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Supports PDF, TXT, Markdown, CSV, JSON, and Word documents (Max 15MB each)
                  </p>
                </div>

                {/* Selected Files List */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    <span className="text-[11px] font-semibold text-slate-700 block">
                      Files ready to index ({selectedFiles.length}):
                    </span>
                    {selectedFiles.map((f, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200 text-[11px]"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="font-medium text-slate-800 truncate">{f.name}</span>
                          <span className="text-slate-400 shrink-0">({formatFileSize(f.size)})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="text-slate-400 hover:text-rose-600 p-0.5 rounded"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setSelectedFiles([]);
                    }}
                    className="px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={selectedFiles.length === 0 || isSubmitting}
                    onClick={handleUploadSubmit}
                    className="px-3.5 py-1.5 rounded bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Indexing Files...' : `Upload & Index (${selectedFiles.length})`}</span>
                  </button>
                </div>
              </div>
            )}

            {/* MANUAL ENTRY MODE */}
            {modalMode === 'MANUAL_ENTRY' && (
              <form onSubmit={handleManualAdd} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Document Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Return Policy, Sizing Chart, Holiday Shipping"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Source Category</label>
                  <select
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800"
                  >
                    <option value="FAQ">FAQ Answer</option>
                    <option value="POLICY">Official Business Policy</option>
                    <option value="TEXT">Product Specifications</option>
                    <option value="URL">Website Reference</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Content Text</label>
                  <textarea
                    rows={6}
                    placeholder="Paste complete factual guidelines here..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs text-slate-800"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-3 py-1.5 rounded bg-indigo-600 text-white font-medium hover:bg-indigo-700"
                  >
                    {isSubmitting ? 'Saving...' : 'Add Knowledge'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Document Content / File Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-2xl w-full p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-semibold text-slate-900">{previewDoc.title}</h3>
                {previewDoc.fileName && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-mono">
                    {previewDoc.fileName}
                  </span>
                )}
              </div>
              <button onClick={() => setPreviewDoc(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto bg-slate-50 p-3 rounded border border-slate-200 text-xs font-mono leading-relaxed whitespace-pre-wrap text-slate-800">
              {previewDoc.content}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[10px] text-slate-400">
                Created: {new Date(previewDoc.createdAt).toLocaleDateString()} • Grounded for AI replies
              </span>
              <div className="flex items-center gap-2">
                {previewDoc.sourceType === 'FILE' && (
                  <button
                    onClick={() => handleDownloadFile(previewDoc)}
                    className="px-3 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1 font-medium"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download File</span>
                  </button>
                )}
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="px-3 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
