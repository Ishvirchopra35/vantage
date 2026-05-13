'use client'
import { useState, useRef, DragEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ResumeUploadProps {
  userId: string
  existingFileName?: string | null
  onUploadComplete: (fileUrl: string, rawText: string) => void
}

export default function ResumeUpload({ userId, existingFileName, onUploadComplete }: ResumeUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) validateAndSet(file)
  }

  const validateAndSet = (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are accepted')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File must be under 5MB')
      return
    }
    setError(null)
    setSelectedFile(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    setUploading(true)
    setError(null)
    setProgress(0)

    try {
      const filePath = `${userId}/resume-${Date.now()}.pdf`
      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filePath, selectedFile, { upsert: true })
      if (uploadError) throw uploadError
      setProgress(50)

      const { data: signedData, error: signedError } = await supabase.storage
        .from('resumes')
        .createSignedUrl(filePath, 300)
      if (signedError || !signedData?.signedUrl) throw signedError ?? new Error('Failed to get signed URL')
      const signedUrl = signedData.signedUrl
      setProgress(65)

      const parseRes = await fetch('/api/parse-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl: signedUrl }),
      })
      if (!parseRes.ok) throw new Error('Failed to parse resume')
      const { text: rawText } = await parseRes.json()
      setProgress(85)

      const { error: dbError } = await supabase
        .from('resumes')
        .upsert({ user_id: userId, file_url: signedUrl, file_name: selectedFile.name, raw_text: rawText, is_base: true })
      if (dbError) throw dbError
      setProgress(100)

      setUploading(false)
      setSelectedFile(null)
      onUploadComplete(signedUrl, rawText)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
      setUploading(false)
      setProgress(0)
    }
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: '32px',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'border-color 0.2s'
      }}
      onClick={() => { if (!uploading && !(!selectedFile && existingFileName)) inputRef.current?.click() }}
    >
      <input ref={inputRef} type="file" accept=".pdf" style={{ display: 'none' }}
        onChange={(e) => e.target.files?.[0] && validateAndSet(e.target.files[0])} />

      {/* Success state — existing resume on file */}
      {!selectedFile && !uploading && existingFileName && (
        <div>
          <p style={{ color: 'var(--success, #22c55e)', marginBottom: 8, fontSize: 14 }}>
            ✓ {existingFileName}
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}
            style={{ fontSize: 13, color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Replace
          </button>
        </div>
      )}

      {/* File selected, ready to upload */}
      {selectedFile && !uploading && (
        <div onClick={(e) => e.stopPropagation()}>
          <p style={{ fontSize: 14, marginBottom: 12 }}>{selectedFile.name}</p>
          <button
            onClick={handleUpload}
            disabled={uploading}
            style={{
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              border: 'none',
              borderRadius: 'var(--radius)',
              padding: '8px 20px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 14,
            }}
          >
            Upload
          </button>
        </div>
      )}

      {/* Progress bar while uploading */}
      {uploading && (
        <div>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)', marginBottom: 12 }}>
            {progress < 50 ? 'Uploading…' : progress < 85 ? 'Parsing resume…' : 'Saving…'}
          </p>
          <div style={{ background: 'var(--border)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
            <div style={{
              background: 'var(--primary)',
              height: '100%',
              width: `${progress}%`,
              transition: 'width 0.3s ease',
            }} />
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 8 }}>{progress}%</p>
        </div>
      )}

      {/* Idle — no file, no existing resume */}
      {!selectedFile && !uploading && !existingFileName && (
        <div>
          <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>
            Drag and drop your resume here, or{' '}
            <span style={{ color: 'var(--primary)', textDecoration: 'underline' }}>browse</span>
          </p>
          <p style={{ color: 'var(--muted-foreground)', fontSize: 12, marginTop: 4 }}>PDF only · max 5MB</p>
        </div>
      )}

      {error && (
        <p style={{ color: 'var(--destructive)', fontSize: 13, marginTop: 8 }}>{error}</p>
      )}
    </div>
  )
}