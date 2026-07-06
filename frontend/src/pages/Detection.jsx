import { useEffect, useRef, useState } from 'react'
import { api, createCameraWebSocket, getOutputUrl } from '../api'

const CLASS_COLORS = {
  Gloves: '#e74c3c',
  Helmet: '#3498db',
  'Face Mask': '#2ecc71',
  Person: '#f39c12',
  'Safety Vest': '#9b59b6',
}

const SEVERITY_STYLE = {
  high: { bg: 'var(--danger-bg)', color: 'var(--danger)', label: 'HIGH RISK' },
  medium: { bg: 'var(--warning-bg)', color: 'var(--warning)', label: 'MEDIUM RISK' },
  low: { bg: 'var(--success-bg)', color: 'var(--success)', label: 'COMPLIANT' },
}

const RESULT_LABEL_STYLE = {
  fontSize: 11,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 8,
  fontWeight: 600,
}

function DetectionList({ detections }) {
  if (!detections?.length) return null

  const counts = {}
  detections.forEach((d) => {
    counts[d.class] = (counts[d.class] || 0) + 1
  })

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {Object.entries(counts).map(([cls, cnt]) => (
        <span
          key={cls}
          style={{
            padding: '4px 12px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            background: `${CLASS_COLORS[cls] || '#888'}22`,
            color: CLASS_COLORS[cls] || '#888',
            border: `1px solid ${(CLASS_COLORS[cls] || '#888')}44`,
          }}
        >
          {cls} x{cnt}
        </span>
      ))}
    </div>
  )
}

function MissingBadges({ missing }) {
  if (!missing?.length) return <span style={{ color: 'var(--success)', fontSize: 13 }}>All PPE detected</span>

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {missing.map((m) => (
        <span key={m} className="badge badge-high">
          Missing {m}
        </span>
      ))}
    </div>
  )
}

function RawScoresTable({ detections }) {
  if (!detections?.length) return null

  const sorted = [...detections].sort((a, b) => b.confidence - a.confidence)
  return (
    <div style={{ marginTop: 4 }}>
      <p style={RESULT_LABEL_STYLE}>Raw Scores</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {sorted.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 90,
                fontSize: 11,
                fontWeight: 600,
                color: CLASS_COLORS[d.class] || '#888',
                flexShrink: 0,
              }}
            >
              {d.class}
            </span>
            <div
              style={{
                flex: 1,
                height: 6,
                background: 'var(--border)',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  borderRadius: 3,
                  width: `${d.confidence * 100}%`,
                  background: CLASS_COLORS[d.class] || '#888',
                }}
              />
            </div>
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                width: 38,
                textAlign: 'right',
                flexShrink: 0,
              }}
            >
              {(d.confidence * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SliderRow({ label, value, min, max, step, onChange, fmt }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 110, flexShrink: 0 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
      />
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', width: 36, textAlign: 'right', flexShrink: 0 }}>
        {fmt(value)}
      </span>
    </div>
  )
}

export default function Detection() {
  const [mode, setMode] = useState('image')
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [conf, setConf] = useState(0.25)
  const [iou, setIou] = useState(0.45)
  const [showThresholds, setShowThresholds] = useState(false)
  const [videoProgress, setVideoProgress] = useState(0)
  const [streaming, setStreaming] = useState(false)
  const [streamDone, setStreamDone] = useState(false)
  const [currentFrameDetections, setCurrentFrameDetections] = useState([])
  const [currentMissing, setCurrentMissing] = useState([])
  const [cameraStarting, setCameraStarting] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [liveSeverity, setLiveSeverity] = useState(null)
  const [videoPreviewNonce, setVideoPreviewNonce] = useState(0)

  const canvasRef = useRef(null)
  const captureVideoRef = useRef(null)
  const captureCanvasRef = useRef(null)
  const previewRef = useRef(null)
  const wsRef = useRef(null)
  const streamDoneRef = useRef(false)
  const cameraStreamRef = useRef(null)
  const cameraIntervalRef = useRef(null)
  const cameraFramePendingRef = useRef(false)
  const cameraManualStopRef = useRef(false)

  useEffect(() => {
    return () => {
      stopCameraResources()
      if (wsRef.current && wsRef.current.readyState < WebSocket.CLOSING) {
        wsRef.current.close()
      }
      revokePreviewUrl(previewRef.current)
    }
  }, [])

  function revokePreviewUrl(url) {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url)
    }
  }

  function replacePreview(nextPreview) {
    revokePreviewUrl(previewRef.current)
    previewRef.current = nextPreview
    setPreview(nextPreview)
  }

  function clearPreviewCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    canvas.width = 0
    canvas.height = 0
  }

  function drawBlobToPreview(blobLike) {
    const blob = blobLike instanceof Blob ? blobLike : new Blob([blobLike], { type: 'image/jpeg' })
    const url = URL.createObjectURL(blob)
    const img = new Image()

    img.onload = () => {
      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0)
      }
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  function stopCameraResources() {
    if (cameraIntervalRef.current) {
      window.clearInterval(cameraIntervalRef.current)
      cameraIntervalRef.current = null
    }

    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop())
      cameraStreamRef.current = null
    }

    if (captureVideoRef.current) {
      captureVideoRef.current.pause?.()
      captureVideoRef.current.srcObject = null
    }

    cameraFramePendingRef.current = false
  }

  function stopCameraDetection() {
    cameraManualStopRef.current = true
    stopCameraResources()

    if (wsRef.current && wsRef.current.readyState < WebSocket.CLOSING) {
      wsRef.current.close()
    }
    wsRef.current = null

    clearPreviewCanvas()
    setCameraStarting(false)
    setCameraActive(false)
    setLiveSeverity(null)
    setCurrentFrameDetections([])
    setCurrentMissing([])
  }

  function reset() {
    streamDoneRef.current = false
    cameraManualStopRef.current = true

    if (wsRef.current && wsRef.current.readyState < WebSocket.CLOSING) {
      wsRef.current.close()
    }
    wsRef.current = null

    stopCameraResources()
    clearPreviewCanvas()

    setFile(null)
    replacePreview(null)
    setResult(null)
    setError('')
    setLoading(false)
    setVideoProgress(0)
    setStreaming(false)
    setStreamDone(false)
    setVideoPreviewNonce(0)
    setCurrentFrameDetections([])
    setCurrentMissing([])
    setCameraStarting(false)
    setCameraActive(false)
    setLiveSeverity(null)
  }

  function onFileSelect(f) {
    if (!f) return

    reset()
    setFile(f)
    if (f.type.startsWith('image/')) {
      setMode('image')
      replacePreview(URL.createObjectURL(f))
    } else if (f.type.startsWith('video/')) {
      setMode('video')
      replacePreview(URL.createObjectURL(f))
    }
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) onFileSelect(droppedFile)
  }

  async function runImageDetection() {
    if (!file) return

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.detectImage(fd, conf, iou)
      setResult(res)
      if (res.output_file) replacePreview(getOutputUrl(res.output_file))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function runVideoDetection() {
    if (!file) return

    setLoading(true)
    setError('')
    setResult(null)
    setVideoProgress(0)
    setCurrentFrameDetections([])
    setCurrentMissing([])
    streamDoneRef.current = false

    try {
      const fd = new FormData()
      fd.append('file', file)
      const { task_id } = await api.uploadVideo(fd, conf, iou)

      setLoading(false)
      setStreaming(true)
      const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/detect/video/${task_id}`)
      wsRef.current = ws

      let expectingFrame = false

      ws.onmessage = (evt) => {
        if (typeof evt.data === 'string') {
          const msg = JSON.parse(evt.data)

          if (msg.type === 'frame') {
            setVideoProgress(msg.progress)
            setCurrentFrameDetections(msg.detections || [])
            setCurrentMissing(msg.missing || [])
            expectingFrame = true
          } else if (msg.type === 'done') {
            if (msg.output_file) {
              setVideoPreviewNonce(Date.now())
              replacePreview(`${getOutputUrl(msg.output_file)}?v=${Date.now()}`)
            }
            streamDoneRef.current = true
            setStreamDone(true)
            setStreaming(false)
            setResult({
              missing_ppe: msg.missing_ppe,
              severity: msg.severity,
              output_file: msg.output_file,
              has_violation: msg.has_violation,
              total_frames: msg.total_frames,
            })
            ws.close()
          } else if (msg.type === 'error') {
            setError(msg.message)
            setStreaming(false)
            ws.close()
          }
        } else if ((evt.data instanceof Blob || evt.data instanceof ArrayBuffer) && expectingFrame) {
          expectingFrame = false
          drawBlobToPreview(evt.data)
        }
      }

      ws.onerror = () => {
        setError('WebSocket connection error')
        setStreaming(false)
      }

      ws.onclose = () => {
        if (!streamDoneRef.current) {
          setStreaming(false)
        }
      }
    } catch (e) {
      setError(e.message)
      setLoading(false)
      setStreaming(false)
    }
  }

  async function sendCameraFrame(ws) {
    const video = captureVideoRef.current
    if (!video || !cameraStreamRef.current || ws.readyState !== WebSocket.OPEN || cameraFramePendingRef.current) return
    if (!video.videoWidth || !video.videoHeight) return

    const canvas = captureCanvasRef.current || document.createElement('canvas')
    captureCanvasRef.current = canvas

    const targetWidth = Math.min(video.videoWidth, 640)
    const scale = targetWidth / video.videoWidth
    const targetHeight = Math.max(1, Math.round(video.videoHeight * scale))

    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext('2d')
    ctx?.drawImage(video, 0, 0, targetWidth, targetHeight)

    cameraFramePendingRef.current = true

    canvas.toBlob(async (blob) => {
      if (!blob) {
        cameraFramePendingRef.current = false
        return
      }

      try {
        const buffer = await blob.arrayBuffer()
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(buffer)
        } else {
          cameraFramePendingRef.current = false
        }
      } catch {
        cameraFramePendingRef.current = false
      }
    }, 'image/jpeg', 0.75)
  }

  async function startCameraDetection() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Live camera is available only in supported browsers on HTTPS or localhost.')
      return
    }

    setError('')
    setResult(null)
    replacePreview(null)
    clearPreviewCanvas()
    setCurrentFrameDetections([])
    setCurrentMissing([])
    setLiveSeverity(null)
    setCameraStarting(true)
    setCameraActive(false)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      })

      cameraStreamRef.current = stream
      cameraManualStopRef.current = false

      const video = captureVideoRef.current
      if (!video) {
        throw new Error('Camera preview is not available')
      }

      video.srcObject = stream
      await video.play()

      const ws = createCameraWebSocket(conf, iou)
      wsRef.current = ws
      let expectingFrame = false

      ws.onopen = () => {
        setCameraStarting(false)
        setCameraActive(true)
        cameraIntervalRef.current = window.setInterval(() => {
          sendCameraFrame(ws)
        }, 400)
      }

      ws.onmessage = (evt) => {
        if (typeof evt.data === 'string') {
          const msg = JSON.parse(evt.data)

          if (msg.type === 'frame') {
            setCurrentFrameDetections(msg.detections || [])
            setCurrentMissing(msg.missing || [])
            setLiveSeverity(msg.severity || null)
            expectingFrame = true
          } else if (msg.type === 'error') {
            cameraFramePendingRef.current = false
            setError(msg.message)
            stopCameraDetection()
          }
        } else if ((evt.data instanceof Blob || evt.data instanceof ArrayBuffer) && expectingFrame) {
          expectingFrame = false
          cameraFramePendingRef.current = false
          drawBlobToPreview(evt.data)
        }
      }

      ws.onerror = () => {
        cameraFramePendingRef.current = false
        setError('Live camera connection error')
        stopCameraDetection()
      }

      ws.onclose = () => {
        cameraFramePendingRef.current = false
        stopCameraResources()
        if (!cameraManualStopRef.current) {
          setCameraStarting(false)
          setCameraActive(false)
        }
      }
    } catch (e) {
      stopCameraResources()
      clearPreviewCanvas()
      setCameraStarting(false)
      setCameraActive(false)
      if (e?.name === 'NotAllowedError') {
        setError('Camera access was denied by the browser.')
      } else if (e?.name === 'NotFoundError') {
        setError('No camera device was found.')
      } else {
        setError(e.message || 'Could not start the live camera.')
      }
    }
  }

  const isProcessing = loading || streaming || cameraStarting
  const pct = (value) => `${Math.round(value * 100)}%`
  const previewTitle = mode === 'video' && streaming
    ? 'Live Detection'
    : mode === 'camera' && (cameraActive || cameraStarting)
      ? 'Live Camera'
      : 'Preview'

  const severityBanner = (severity, extra) => ({
    padding: '10px 14px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid',
    fontSize: 13,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    background: SEVERITY_STYLE[severity]?.bg,
    color: SEVERITY_STYLE[severity]?.color,
    borderColor: `${SEVERITY_STYLE[severity]?.color || '#888'}44`,
    ...extra,
  })

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">PPE Detection</h1>
        <p className="page-subtitle">Upload an image, a video, or use your laptop camera for live analysis</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '390px 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { id: 'image', label: 'Image' },
              { id: 'video', label: 'Video' },
              { id: 'camera', label: 'Live Camera' },
            ].map((option) => (
              <button
                key={option.id}
                className={mode === option.id ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                onClick={() => {
                  reset()
                  setMode(option.id)
                }}
              >
                {option.label}
              </button>
            ))}
            <button
              className="btn btn-secondary btn-sm"
              style={{ marginLeft: 'auto', color: showThresholds ? 'var(--accent)' : undefined }}
              onClick={() => setShowThresholds((value) => !value)}
            >
              Thresholds
            </button>
          </div>

          {showThresholds && (
            <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Detection Thresholds</p>
              <SliderRow label="Confidence" value={conf} min={0.05} max={0.95} step={0.05} onChange={setConf} fmt={pct} />
              <SliderRow label="IoU (NMS)" value={iou} min={0.1} max={0.9} step={0.05} onChange={setIou} fmt={pct} />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Lower confidence finds more objects but may increase false positives.
                <br />
                Higher confidence is stricter and may miss weaker detections.
              </p>
            </div>
          )}

          {mode !== 'camera' ? (
            <>
              <div
                style={{
                  border: `2px ${dragOver || file ? 'solid' : 'dashed'} ${dragOver || file ? 'var(--accent)' : 'var(--border-light)'}`,
                  borderRadius: 'var(--radius-lg)',
                  padding: '36px 20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: dragOver ? 'var(--accent-light)' : 'var(--bg-card)',
                  minHeight: 150,
                  transition: 'all 0.2s',
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  accept={mode === 'image' ? 'image/*' : 'video/*'}
                  style={{ display: 'none' }}
                  onChange={(e) => onFileSelect(e.target.files[0])}
                />
                {file ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>{mode === 'image' ? 'IMG' : 'VID'}</div>
                    <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 13 }}>{file.name}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ marginTop: 10 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        reset()
                        setMode(mode)
                      }}
                    >
                      Change File
                    </button>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', pointerEvents: 'none' }}>
                    <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>{mode === 'image' ? 'IMG' : 'VID'}</div>
                    <p style={{ color: 'var(--text-primary)', fontWeight: 500, marginBottom: 6 }}>
                      Drop {mode === 'image' ? 'an image' : 'a video'} here
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      or click to browse · {mode === 'image' ? 'JPG, PNG, WEBP' : 'MP4, AVI, MOV'}
                    </p>
                  </div>
                )}
              </div>

              <button
                className="btn btn-primary btn-full btn-lg"
                onClick={mode === 'image' ? runImageDetection : runVideoDetection}
                disabled={!file || isProcessing}
              >
                {isProcessing ? <><span className="spinner" /> Processing...</> : 'Run Detection'}
              </button>
            </>
          ) : (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Live Camera</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Start your laptop camera to stream frames to the SafeVision detector. Live camera works on localhost or HTTPS.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={startCameraDetection} disabled={cameraActive || cameraStarting}>
                  {cameraStarting ? <><span className="spinner" /> Starting...</> : 'Start Camera'}
                </button>
                <button className="btn btn-secondary" onClick={stopCameraDetection} disabled={!cameraActive && !cameraStarting}>
                  Stop Camera
                </button>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Frames are sampled at a reduced rate to keep the live preview responsive.
              </p>
            </div>
          )}

          {error && <div className="alert alert-error">{error}</div>}

          {mode === 'image' && result && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Detection Results</h3>
              {result.severity && (
                <div style={severityBanner(result.severity)}>
                  {SEVERITY_STYLE[result.severity]?.label}
                  <span style={{ marginLeft: 8, fontWeight: 400, fontSize: 12 }}>conf {pct(conf)}</span>
                </div>
              )}
              <div>
                <p style={RESULT_LABEL_STYLE}>Detected Items</p>
                <DetectionList detections={result.detections} />
              </div>
              <div>
                <p style={RESULT_LABEL_STYLE}>PPE Status</p>
                <MissingBadges missing={result.missing_ppe} />
              </div>
              <RawScoresTable detections={result.detections} />
              {result.output_file && (
                <a href={getOutputUrl(result.output_file)} download className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}>
                  Download Annotated Image
                </a>
              )}
            </div>
          )}

          {mode === 'video' && (streaming || streamDone) && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>{streaming ? 'Processing...' : 'Analysis Complete'}</h3>
              {streaming && (
                <>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${videoProgress}%` }} />
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{videoProgress}% - conf {pct(conf)}</p>
                  <DetectionList detections={currentFrameDetections} />
                  {(currentFrameDetections.length > 0 || currentMissing.length > 0) && (
                    <MissingBadges missing={currentMissing} />
                  )}
                  <RawScoresTable detections={currentFrameDetections} />
                </>
              )}
              {streamDone && result && (
                <>
                  {result.severity && (
                    <div style={severityBanner(result.severity)}>
                      {SEVERITY_STYLE[result.severity]?.label} - {result.total_frames} frames
                    </div>
                  )}
                  <MissingBadges missing={result.missing_ppe} />
                  {result.output_file && (
                    <a href={getOutputUrl(result.output_file)} download className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', marginTop: 4 }}>
                      Download Annotated Video
                    </a>
                  )}
                </>
              )}
            </div>
          )}

          {mode === 'camera' && (cameraActive || cameraStarting || currentFrameDetections.length > 0) && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Live Camera Results</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Status: {cameraStarting ? 'Starting camera' : cameraActive ? 'Live' : 'Stopped'}
              </p>
              {liveSeverity && (
                <div style={severityBanner(liveSeverity)}>
                  {SEVERITY_STYLE[liveSeverity]?.label}
                  <span style={{ marginLeft: 8, fontWeight: 400, fontSize: 12 }}>conf {pct(conf)}</span>
                </div>
              )}
              <div>
                <p style={RESULT_LABEL_STYLE}>Detected Items</p>
                {currentFrameDetections.length > 0 ? (
                  <DetectionList detections={currentFrameDetections} />
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Waiting for camera frames...</p>
                )}
              </div>
              {(currentFrameDetections.length > 0 || currentMissing.length > 0) && (
                <div>
                  <p style={RESULT_LABEL_STYLE}>PPE Status</p>
                  <MissingBadges missing={currentMissing} />
                </div>
              )}
              <RawScoresTable detections={currentFrameDetections} />
            </div>
          )}
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 440 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>{previewTitle}</h3>

          {mode === 'image' && preview && (
            <img src={preview} alt="Preview" style={{ width: '100%', borderRadius: 8, objectFit: 'contain', maxHeight: 520 }} />
          )}

          {mode === 'video' && (
            streaming
              ? <canvas ref={canvasRef} style={{ width: '100%', borderRadius: 8, background: '#000', maxHeight: 520 }} />
              : preview
                ? <video key={`${preview}-${videoPreviewNonce}`} src={preview} controls autoPlay style={{ width: '100%', borderRadius: 8, maxHeight: 520 }} />
                : null
          )}

          {mode === 'camera' && (
            <>
              <video ref={captureVideoRef} autoPlay muted playsInline style={{ display: 'none' }} />
              {(cameraActive || cameraStarting)
                ? <canvas ref={canvasRef} style={{ width: '100%', borderRadius: 8, background: '#000', maxHeight: 520 }} />
                : null}
            </>
          )}

          {!preview && !(mode === 'camera' && (cameraActive || cameraStarting)) && (
            <div className="empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div className="icon">SV</div>
              <p>{mode === 'camera' ? 'Start the camera to see live annotated frames here' : 'Upload a file to see detection results here'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
