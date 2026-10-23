import React, { useState, useEffect } from 'react'
import {
  PlusCircle,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCw,
  Trash2,
  Layers,
  Activity,
  Cpu,
  Zap,
  Info,
  Box,
  Check,
  TrendingUp,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { soundEffects } from '../lib/audioAlerts'

export default function FewShotStudio({ onScanRefresh }) {
  const [registry, setRegistry] = useState([])
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [trainLoading, setTrainLoading] = useState({})
  const [selectedFiles, setSelectedFiles] = useState([])
  const [skuName, setSkuName] = useState('')
  const [category, setCategory] = useState('Beverages')
  const [designatedZone, setDesignatedZone] = useState('Top-Right Deck')
  const [reorderThreshold, setReorderThreshold] = useState(4)
  const [message, setMessage] = useState(null)
  const [testResult, setTestResult] = useState(null)

  const fetchRegistry = async () => {
    try {
      const res = await fetch('/api/few-shot/registry')
      if (res.ok) {
        const data = await res.json()
        setRegistry(data.enrolled_products || [])
      }
    } catch (err) {
      console.warn('Failed to load few-shot registry:', err)
    }
  }

  useEffect(() => {
    fetchRegistry()
    const interval = setInterval(fetchRegistry, 3000)
    return () => clearInterval(interval)
  }, [])

  const handleFileSelect = (e) => {
    if (e.target.files) {
      const filesArr = Array.from(e.target.files)
      setSelectedFiles(filesArr)
    }
  }

  const handleCustomEnroll = async (e) => {
    e.preventDefault()
    if (!skuName.trim() || selectedFiles.length < 3) {
      setMessage({ type: 'error', text: 'Please enter SKU name and select at least 3 images (15–20 recommended).' })
      return
    }

    setLoading(true)
    setMessage(null)

    const formData = new FormData()
    selectedFiles.forEach((file) => {
      formData.append('files', file)
    })

    try {
      const url = `/api/few-shot/enroll?sku_name=${encodeURIComponent(skuName.trim())}&category=${encodeURIComponent(category)}&designated_zone=${encodeURIComponent(designatedZone)}&reorder_threshold=${reorderThreshold}`
      const res = await fetch(url, {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        setMessage({ type: 'success', text: data.message })
        soundEffects.playSuccess()
        confetti({ particleCount: 50, spread: 70 })
        setSelectedFiles([])
        setSkuName('')
        fetchRegistry()
        if (onScanRefresh) onScanRefresh()
      } else {
        const errData = await res.json()
        setMessage({ type: 'error', text: errData.detail || 'Enrollment failed.' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network or server error during enrollment.' })
    } finally {
      setLoading(false)
    }
  }

  const handleDemoEnroll = async () => {
    setDemoLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/few-shot/demo-enroll?sku_name=Pepsi%20Max%20Can&category=Beverages&designated_zone=Top-Right%20Deck&reorder_threshold=4', {
        method: 'POST',
      })
      if (res.ok) {
        const data = await res.json()
        setMessage({ type: 'success', text: data.message })
        soundEffects.playSuccess()
        confetti({ particleCount: 60, spread: 80 })
        fetchRegistry()
        if (onScanRefresh) onScanRefresh()
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Demo enrollment failed.' })
    } finally {
      setDemoLoading(false)
    }
  }

  const handleTriggerSelfTrain = async (targetSku) => {
    setTrainLoading((prev) => ({ ...prev, [targetSku]: true }))
    try {
      const res = await fetch(`/api/few-shot/trigger-self-train?sku_name=${encodeURIComponent(targetSku)}`, {
        method: 'POST',
      })
      if (res.ok) {
        const data = await res.json()
        setMessage({ type: 'success', text: data.message })
        soundEffects.playSuccess()
        fetchRegistry()
      }
    } catch (err) {
      console.warn('Self-train trigger failed:', err)
    } finally {
      setTrainLoading((prev) => ({ ...prev, [targetSku]: false }))
    }
  }

  const handleDeleteProduct = async (targetSku) => {
    if (!window.confirm(`Unenroll '${targetSku}' from active prototype registry?`)) return
    try {
      const res = await fetch(`/api/few-shot/product/${encodeURIComponent(targetSku)}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        fetchRegistry()
        setMessage({ type: 'info', text: `Unenrolled '${targetSku}'.` })
        if (onScanRefresh) onScanRefresh()
      }
    } catch (err) {
      console.warn('Delete failed:', err)
    }
  }

  const handleRunShelfTest = async () => {
    try {
      const res = await fetch('/api/shelf-test', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setTestResult(data.state)
        soundEffects.playSuccess()
        confetti({ particleCount: 30, spread: 50 })
        fetchRegistry()
        if (onScanRefresh) onScanRefresh()
      }
    } catch (err) {
      console.warn('Shelf test error:', err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner (Clean Graphite, NO PURPLE) */}
      <div className="figma-card p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white">
                <Layers className="w-4 h-4 text-zinc-200" />
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Few-Shot Object Enrollment &amp; Continual Online Learning
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-zinc-300 border border-white/20">
                MobileNetV3 + Metric Projection
              </span>
            </div>
            <p className="text-xs text-zinc-400 max-w-3xl">
              Introduce novel retail products with 15–20 reference frames. The deep metric projection head extracts a 128-dimensional unit prototype, and the system dynamically updates weights online whenever the object is detected on the shelf.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleDemoEnroll}
              disabled={demoLoading}
              className="btn-tactile-white text-xs flex items-center gap-2 disabled:opacity-50"
            >
              <Zap className={`w-3.5 h-3.5 ${demoLoading ? 'animate-spin' : ''}`} />
              <span>{demoLoading ? 'Synthesizing...' : '1-Click Demo (Pepsi Max)'}</span>
            </button>

            <button
              onClick={handleRunShelfTest}
              className="btn-tactile-dark text-xs flex items-center gap-2"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Test Shelf Scene</span>
            </button>
          </div>
        </div>

        {message && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200 ${
              message.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : message.type === 'error'
                ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                : 'bg-blue-500/10 border border-blue-500/30 text-blue-300'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}
      </div>

      {/* Grid: Active Enrolled SKUs Cards */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Active Enrolled SKUs ({registry.length})
            </h3>
          </div>
          <span className="text-xs text-zinc-400 font-mono">
            Metric Dimension: 128 | Real-Time Continual EMA Active
          </span>
        </div>

        {registry.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#15171c] border border-white/10 text-center space-y-3">
            <Layers className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-sm text-zinc-300 font-semibold">No custom few-shot products enrolled yet</p>
            <p className="text-xs text-zinc-500">
              Click the "1-Click Demo (Pepsi Max)" button above or upload 15 reference photos below.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {registry.map((item) => (
              <div
                key={item.sku_name}
                className="figma-card p-5 space-y-4 shadow-xl relative overflow-hidden group"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-base font-bold text-white tracking-tight">{item.sku_name}</h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] text-zinc-400 font-semibold">{item.category}</span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-[11px] text-zinc-400">{item.designated_zone}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteProduct(item.sku_name)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                    title="Unenroll SKU"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Metric Gauges */}
                <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-black/40 border border-white/5 text-center">
                  <div>
                    <span className="text-[10px] text-zinc-400 block">Threshold</span>
                    <span className="text-xs font-mono font-bold text-white">
                      {item.detection_threshold.toFixed(3)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block">Sightings</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {item.total_observations}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block">Self-Trains</span>
                    <span className="text-xs font-mono font-bold text-zinc-300">
                      {item.self_training_updates}
                    </span>
                  </div>
                </div>

                {/* Prototype Drift Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-zinc-400 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-zinc-400" />
                      <span>Online Prototype Drift</span>
                    </span>
                    <span className="text-zinc-300 font-mono font-bold">{item.prototype_drift_pct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, item.prototype_drift_pct * 4)}%` }}
                    />
                  </div>
                </div>

                {/* Status & Action */}
                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                  <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Learning Active</span>
                  </span>

                  <button
                    onClick={() => handleTriggerSelfTrain(item.sku_name)}
                    disabled={trainLoading[item.sku_name]}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 transition-all"
                  >
                    <RotateCw className={`w-3 h-3 ${trainLoading[item.sku_name] ? 'animate-spin' : ''}`} />
                    <span>Trigger Train Pass</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual Upload Enrollment Form */}
      <div className="figma-card p-6 space-y-5">
        <div className="flex items-center gap-2">
          <UploadCloud className="w-5 h-5 text-zinc-300" />
          <h3 className="text-base font-bold text-white">Upload 15–20 Product Photos for Cold-Start Enrollment</h3>
        </div>

        <form onSubmit={handleCustomEnroll} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Product Brand / SKU</label>
              <input
                type="text"
                placeholder="e.g. Red Bull Energy 250ml"
                value={skuName}
                onChange={(e) => setSkuName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-zinc-500 text-xs focus:outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Department Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/10 text-white text-xs"
              >
                <option value="Beverages">Beverages</option>
                <option value="Snacks / Chips">Snacks / Chips</option>
                <option value="Confectionery">Confectionery</option>
                <option value="Biscuits">Biscuits</option>
                <option value="Dairy">Dairy</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Designated Shelf Zone</label>
              <select
                value={designatedZone}
                onChange={(e) => setDesignatedZone(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/10 text-white text-xs"
              >
                <option value="Top-Left Deck">Top-Left Deck</option>
                <option value="Top-Right Deck">Top-Right Deck</option>
                <option value="Bottom-Left Shelf">Bottom-Left Shelf</option>
                <option value="Bottom-Right Shelf">Bottom-Right Shelf</option>
              </select>
            </div>
          </div>

          {/* Drag & Drop File Selector */}
          <div className="p-6 rounded-2xl border-2 border-dashed border-white/10 hover:border-white/30 bg-black/20 text-center space-y-2 transition-all">
            <input
              type="file"
              multiple
              accept="image/*"
              id="file-upload"
              onChange={handleFileSelect}
              className="hidden"
            />
            <label htmlFor="file-upload" className="cursor-pointer block space-y-2">
              <UploadCloud className="w-7 h-7 text-zinc-400 mx-auto" />
              <div className="text-xs text-white font-semibold">
                Click to select 15–20 reference product images from your computer
              </div>
              <div className="text-[11px] text-zinc-400">
                Supports JPG, PNG, WebP • Generates 60 augmented variations (multi-scale, color jitter, affine)
              </div>
            </label>
            {selectedFiles.length > 0 && (
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-mono font-bold">
                <Check className="w-3.5 h-3.5" />
                <span>{selectedFiles.length} images selected</span>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !skuName.trim() || selectedFiles.length < 3}
              className="btn-tactile-white text-xs flex items-center gap-2 disabled:opacity-40"
            >
              <PlusCircle className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Extracting Metric Prototypes...' : 'Enroll SKU & Initialize Online Learning'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Technical Architecture Callout */}
      <div className="figma-card p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-300 uppercase tracking-wider">
          <Cpu className="w-4 h-4 text-zinc-400" />
          <span>Continual Self-Training Mathematical Formulation</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-zinc-400">
          <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
            <span className="font-bold text-white block">1. Cold-Start Prototype Centroid</span>
            <p className="text-[11px]">
              Extracts 576-dim MobileNet features, projects to 128-dim hypersphere, and computes normalized centroid:
            </p>
            <code className="text-[10px] text-zinc-300 font-mono block bg-black p-1 rounded">
              mu = normalize( 1/N * sum z_i )
            </code>
          </div>

          <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
            <span className="font-bold text-white block">2. Online Momentum Adaptation</span>
            <p className="text-[11px]">
              Every high-confidence shelf detection dynamically shifts the prototype via exponential moving average:
            </p>
            <code className="text-[10px] text-zinc-300 font-mono block bg-black p-1 rounded">
              mu(t) = normalize( (1 - a)mu(t-1) + a z_t )
            </code>
          </div>

          <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
            <span className="font-bold text-white block">3. Contrastive Replay Loss</span>
            <p className="text-[11px]">
              Periodic gradient passes pull memory buffer positive crops and push away negative class prototypes:
            </p>
            <code className="text-[10px] text-zinc-300 font-mono block bg-black p-1 rounded">
              L = (1 - z*mu) + 0.5 * relu(z*mu_neg - 0.25)
            </code>
          </div>
        </div>
      </div>
    </div>
  )
}
