'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast, asyncHandler, validateResponse } from '@/lib/error-handler'
import { validateRequired, validateMinLength } from '@/lib/validators'

type ProjectRow = {
  id: string
  name: string
  project_code: string
}

function ReportPageContent() {
  const searchParams = useSearchParams()
  const paramProjectCode = (searchParams.get('project') || '').toUpperCase()

  const [description, setDescription] = useState('')
  const [reporterName, setReporterName] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [selectedProjectCode, setSelectedProjectCode] = useState(paramProjectCode)
  const [searchInput, setSearchInput] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [imageUploadError, setImageUploadError] = useState('')

  const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
  const MAX_FILES = 3

  useEffect(() => {
    async function loadProjects() {
      await asyncHandler(
        async () => {
          const { data, error } = await supabase
            .from('projects')
            .select('id, name, project_code')
            .order('project_code', { ascending: true })

          if (error) throw new Error(error.message)
          setProjects((data as ProjectRow[]) || [])
        },
        {
          context: 'Failed to load buildings',
          showErrorToast: true,
        }
      )
    }

    loadProjects()
  }, [])

  // Only search if input is 2+ characters
  const searchResults = useMemo(() => {
    if (searchInput.trim().length < 2) return []
    
    const lowerSearch = searchInput.toLowerCase()
    return projects.filter((project) =>
      project.name.toLowerCase().includes(lowerSearch) ||
      project.project_code.toLowerCase().includes(lowerSearch)
    )
  }, [searchInput, projects])

  const prevSearchResultsRef = useRef<ProjectRow[] | null>(null)

  // Auto-select if exactly 1 result
  useEffect(() => {
    if (
      searchResults.length === 1 &&
      prevSearchResultsRef.current?.length !== 1
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedProjectCode(searchResults[0].project_code)
      setShowDropdown(false)
    }
    prevSearchResultsRef.current = searchResults
  }, [searchResults])

  const canSubmit = useMemo(() => {
    return Boolean(selectedProjectCode && description.trim().length >= 3)
  }, [selectedProjectCode, description])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    setImageUploadError('')

    // Validate file count
    if (selectedFiles.length + files.length > MAX_FILES) {
      setImageUploadError(`Maximum ${MAX_FILES} images allowed`)
      return
    }

    // Validate each file
    for (const file of files) {
      if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
        setImageUploadError('Only JPG, PNG, and WebP images are supported')
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        setImageUploadError(`File "${file.name}" is too large (max 5MB)`)
        return
      }
    }

    setSelectedFiles([...selectedFiles, ...files])
  }

  function removeFile(indexToRemove: number) {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== indexToRemove))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    setSuccessMessage('')
    setErrorMessage('')
    setImageUploadError('')

    // Validation
    const projectError = validateRequired(selectedProjectCode || '', 'Building')
    if (projectError) {
      setErrorMessage(projectError.message)
      return
    }

    const descError = validateMinLength(description, 3, 'Description')
    if (descError) {
      setErrorMessage(descError.message)
      return
    }

    setLoading(true)

    const result = await asyncHandler(
      async () => {
        const formData = new FormData()
        formData.append('project_code', selectedProjectCode)
        formData.append('description', description.trim())
        formData.append('reporter_name', reporterName.trim() || '')
        formData.append('source', 'web_form')

        // Add selected image files
        selectedFiles.forEach((file) => {
          formData.append('attachments', file)
        })

        const response = await fetch('/api/create-ticket', {
          method: 'POST',
          body: formData,
        })

        await validateResponse(response, 'Failed to submit issue')
        return await response.json()
      },
      {
        context: 'Failed to submit issue',
        showErrorToast: false,
        onError: (error) => {
          setErrorMessage(error)
        },
      }
    )

    if (result) {
      const successMsg = `✓ Issue submitted successfully. Ticket #${result.ticketNumber}`

      // Show warning if some images failed but ticket was created
      if (result.imageUploadWarning) {
        toast.warning(result.imageUploadWarning)
      }

      setSuccessMessage(successMsg)
      toast.success('Issue submitted successfully')

      // Reset form
      setDescription('')
      setReporterName('')
      setSelectedProjectCode('')
      setSearchInput('')
      setSelectedFiles([])
    }

    setLoading(false)
  }

  const selectedProject = selectedProjectCode
    ? projects.find((p) => p.project_code === selectedProjectCode)
    : null

  return (
    <main style={styles.page}>
      <div style={styles.wrapper}>
        <div style={styles.brandRow}>
          <div style={styles.logoBox}>B</div>
          <div>
            <div style={styles.brandTitle}>Bamakor</div>
            <div style={styles.brandSubtitle}>Maintenance Report Form</div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.headerBlock}>
            <h1 style={styles.title}>Report an Issue</h1>
            <p style={styles.subtitle}>
              Fill in the details below and we will forward the issue for treatment.
            </p>
          </div>

          {paramProjectCode && selectedProject ? (
            <div style={styles.projectInfo}>
              <span style={styles.projectLabel}>Building</span>
              <span style={styles.projectValue}>{selectedProject.name}</span>
            </div>
          ) : (
            <div style={styles.field}>
              <label htmlFor="buildingSearch" style={styles.label}>
                Search Building
              </label>
              <div style={styles.searchContainer}>
                <input
                  id="buildingSearch"
                  type="text"
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value)
                    setShowDropdown(true)
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Type building name or address (min 2 characters)"
                  style={styles.input}
                />
                {showDropdown && searchInput.trim().length >= 2 && (
                  <div style={styles.dropdown}>
                    {searchResults.length === 0 ? (
                      <div style={styles.dropdownItem}>No buildings found</div>
                    ) : (
                      searchResults.slice(0, 5).map((project) => (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() => {
                            setSelectedProjectCode(project.project_code)
                            setSearchInput(project.name)
                            setShowDropdown(false)
                          }}
                          style={styles.dropdownItem}
                        >
                          <div style={styles.dropdownItemName}>{project.name}</div>
                          <div style={styles.dropdownItemCode}>{project.project_code}</div>
                        </button>
                      ))
                    )}
                  </div>
                )}
                {searchInput.trim().length >= 2 && searchResults.length === 1 && (
                  <div style={styles.autoSelectNote}>✓ Auto-selected: {searchResults[0].name}</div>
                )}
              </div>
              {selectedProjectCode && !paramProjectCode && (
                <div style={styles.selectedLabel}>
                  Selected: <strong>{selectedProject?.name || selectedProjectCode}</strong>
                </div>
              )}
            </div>
          )}

          {!selectedProjectCode && !paramProjectCode && searchInput.trim().length === 0 && (
            <div style={styles.infoBox}>
              Start typing the building name or address to search.
            </div>
          )}

          {successMessage && <div style={styles.successBox}>{successMessage}</div>}
          {errorMessage && <div style={styles.errorBox}>{errorMessage}</div>}

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label htmlFor="reporterName" style={styles.label}>
                Your Name (optional)
              </label>
              <input
                id="reporterName"
                type="text"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder="Enter your name"
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label htmlFor="description" style={styles.label}>
                Issue Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Example: Water leak near the elevator / electrical issue / broken door..."
                style={styles.textarea}
                rows={6}
              />
            </div>

            <div style={styles.field}>
              <label htmlFor="images" style={styles.label}>
                Upload Images (optional)
              </label>
              <p style={styles.fieldHint}>
                Upload up to {MAX_FILES} photos to help describe the issue. JPG, PNG, WebP max 5MB each.
              </p>
              <input
                id="images"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                style={styles.fileInput}
              />
              {imageUploadError && <div style={styles.errorBox}>{imageUploadError}</div>}
              {selectedFiles.length > 0 && (
                <div style={styles.filePreviewContainer}>
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} style={styles.filePreview}>
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Preview ${idx + 1}`}
                        style={styles.filePreviewImg}
                      />
                      <div style={styles.filePreviewName}>{file.name}</div>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        style={styles.fileRemoveButton}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmit || loading}
              style={{
                ...styles.submitButton,
                opacity: !canSubmit || loading ? 0.6 : 1,
                cursor: !canSubmit || loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Submitting...' : 'Submit Issue'}
            </button>
          </form>

          <div style={styles.footerNote}>
            After submitting, the issue will be recorded in the Bamakor system.
          </div>

          <div style={styles.backRow}>
            <Link href="/" style={styles.backLink}>
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}

export default function ReportPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading...</div>}>
      <ReportPageContent />
    </Suspense>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    height: '100dvh',
    overflow: 'auto',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
    background: 'linear-gradient(180deg, #F5F6F8 0%, #EEF1F4 100%)',
    fontFamily: 'Inter, Arial, Helvetica, sans-serif',
    padding: '32px 16px',
    paddingTop: 'calc(32px + env(safe-area-inset-top))',
    color: '#111827',
  },
  wrapper: {
    maxWidth: '720px',
    margin: '0 auto',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
  },
  logoBox: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #C1121F 0%, #8F0B16 100%)',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '18px',
  },
  brandTitle: {
    fontSize: '20px',
    fontWeight: 800,
  },
  brandSubtitle: {
    fontSize: '13px',
    color: '#6B7280',
  },
  card: {
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '24px',
    padding: '24px',
    boxShadow: '0 12px 30px rgba(17, 24, 39, 0.06)',
  },
  headerBlock: {
    marginBottom: '20px',
  },
  title: {
    margin: 0,
    fontSize: '32px',
    fontWeight: 800,
    lineHeight: 1.1,
  },
  subtitle: {
    margin: '10px 0 0 0',
    color: '#6B7280',
    fontSize: '15px',
    lineHeight: 1.6,
  },
  projectInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
    borderRadius: '14px',
    background: '#F9FAFB',
    border: '1px solid #E5E7EB',
    marginBottom: '18px',
    flexWrap: 'wrap',
  },
  projectLabel: {
    fontSize: '13px',
    color: '#6B7280',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  projectValue: {
    fontSize: '16px',
    fontWeight: 800,
    color: '#111827',
  },
  form: {
    display: 'grid',
    gap: '18px',
  },
  field: {
    display: 'grid',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#374151',
  },
  searchContainer: {
    position: 'relative',
    width: '100%',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '12px',
    border: '1px solid #D1D5DB',
    background: '#FFFFFF',
    fontSize: '15px',
    color: '#111827',
    outline: 'none',
    boxSizing: 'border-box',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    background: '#FFFFFF',
    border: '1px solid #D1D5DB',
    borderTop: 'none',
    borderRadius: '0 0 12px 12px',
    boxShadow: '0 8px 16px rgba(0,0,0,0.08)',
    maxHeight: '240px',
    overflowY: 'auto',
    zIndex: 10,
  },
  dropdownItem: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '12px 16px',
    background: 'none',
    border: 'none',
    borderBottom: '1px solid #F3F4F6',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  },
  dropdownItemName: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '4px',
  },
  dropdownItemCode: {
    fontSize: '12px',
    color: '#6B7280',
  },
  autoSelectNote: {
    fontSize: '13px',
    color: '#059669',
    fontWeight: 600,
    marginTop: '8px',
  },
  selectedLabel: {
    fontSize: '13px',
    color: '#374151',
    marginTop: '8px',
    padding: '8px 12px',
    background: '#F9FAFB',
    borderRadius: '8px',
  },
  infoBox: {
    background: '#F0F9FF',
    color: '#0369A1',
    border: '1px solid #BAE6FD',
    borderRadius: '12px',
    padding: '14px 16px',
    marginBottom: '16px',
    fontSize: '14px',
  },
  textarea: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '12px',
    border: '1px solid #D1D5DB',
    background: '#FFFFFF',
    fontSize: '15px',
    color: '#111827',
    outline: 'none',
    resize: 'vertical',
    boxSizing: 'border-box',
    fontFamily: 'Inter, Arial, Helvetica, sans-serif',
    minHeight: '120px',
  },
  submitButton: {
    background: '#111827',
    color: '#FFFFFF',
    border: '1px solid #111827',
    borderRadius: '12px',
    padding: '14px 18px',
    fontSize: '15px',
    fontWeight: 800,
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  successBox: {
    background: '#ECFDF5',
    color: '#166534',
    border: '1px solid #BBF7D0',
    borderRadius: '12px',
    padding: '14px 16px',
    marginBottom: '16px',
    fontWeight: 600,
  },
  errorBox: {
    background: '#FEF2F2',
    color: '#B91C1C',
    border: '1px solid #FECACA',
    borderRadius: '12px',
    padding: '14px 16px',
    marginBottom: '16px',
    fontWeight: 600,
  },
  footerNote: {
    marginTop: '18px',
    fontSize: '13px',
    color: '#6B7280',
    lineHeight: 1.6,
  },
  backRow: {
    marginTop: '18px',
  },
  backLink: {
    color: '#111827',
    fontWeight: 700,
    textDecoration: 'none',
  },
  fieldHint: {
    fontSize: '13px',
    color: '#6B7280',
    margin: '8px 0 12px 0',
  },
  fileInput: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '2px dashed #D1D5DB',
    background: '#F9FAFB',
    fontSize: '14px',
    color: '#111827',
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  filePreviewContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
    gap: '12px',
    marginTop: '12px',
  },
  filePreview: {
    position: 'relative',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid #E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  filePreviewImg: {
    width: '100%',
    height: '100px',
    objectFit: 'cover',
  },
  filePreviewName: {
    fontSize: '11px',
    padding: '4px 6px',
    color: '#6B7280',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  fileRemoveButton: {
    position: 'absolute',
    top: '4px',
    right: '4px',
    background: 'rgba(0,0,0,0.6)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '16px',
  },
}
