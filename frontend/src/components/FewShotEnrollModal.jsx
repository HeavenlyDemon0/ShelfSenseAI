import React, { useState } from 'react'
import { PlusCircle, Sparkles, X, CheckCircle2, Layers, Tag, UploadCloud, Info } from 'lucide-react'
import confetti from 'canvas-confetti'
import { soundEffects } from '../lib/audioAlerts'

export default function FewShotEnrollModal({ isOpen, onClose, onEnrolled }) {
  const [skuName, setSkuName] = useState('')
  const [category, setCategory] = useState('Beverages')
  const [designatedZone, setDesignatedZone] = useState('Top-Right Deck')
  const [reorderThreshold, setReorderThreshold] = useState(3)
  const [sampleCount, setSampleCount] = useState(10)
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState(null)

  if (!isOpen) return null

  const handleEnroll = async (e) => {
    e.preventDefault()
    if (!skuName.trim()) return

    setLoading(true)
    try {
      const url = `/api/few-shot/demo-enroll?sku_name=${encodeURIComponent(skuName.trim())}&category=${encodeURIComponent(category)}&designated_zone=${encodeURIComponent(designatedZone)}&reorder_threshold=${Number(reorderThreshold)}`
      const res = await fetch(url, {
        method: 'POST',
      })

      if (res.ok) {
        const data = await res.json()
        setSuccessMsg(data.message)
        soundEffects.playSuccess()
        confetti({ particleCount: 40, spread: 60 })
        if (onEnrolled) onEnrolled(data)
        setTimeout(() => {
          setSuccessMsg(null)
          onClose()
        }, 2200)
      }
    } catch (err) {
      console.error('Enrollment error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg p-6 rounded-3xl bg-[#090d16] border border-white/15 shadow-2xl space-y-5">
        {/* Modal Header */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Few-Shot SKU Enrollment</h3>
              <p className="text-xs text-slate-400">Introduce new products in 5–15 frames without full model retraining</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {successMsg ? (
          <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
            <h4 className="text-base font-bold text-white">Product Successfully Enrolled!</h4>
            <p className="text-xs text-slate-300">{successMsg}</p>
          </div>
        ) : (
          <form onSubmit={handleEnroll} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Product Brand / SKU Name</label>
              <input
                type="text"
                placeholder="e.g. Pepsi Max Can, Doritos Nacho Cheese..."
                value={skuName}
                onChange={(e) => setSkuName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white text-xs"
                >
                  <option value="Beverages">Beverages</option>
                  <option value="Snacks">Snacks / Chips</option>
                  <option value="Confectionery">Confectionery</option>
                  <option value="Biscuits">Biscuits</option>
                  <option value="Dairy">Dairy</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Designated Shelf Zone</label>
                <select
                  value={designatedZone}
                  onChange={(e) => setDesignatedZone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white text-xs"
                >
                  <option value="Top-Left Deck">Top-Left Deck</option>
                  <option value="Top-Right Deck">Top-Right Deck</option>
                  <option value="Bottom-Left Shelf">Bottom-Left Shelf</option>
                  <option value="Bottom-Right Shelf">Bottom-Right Shelf</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Reorder Threshold (Min Units)</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={reorderThreshold}
                  onChange={(e) => setReorderThreshold(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Reference Samples</label>
                <select
                  value={sampleCount}
                  onChange={(e) => setSampleCount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white text-xs"
                >
                  <option value={5}>5 Images (Rapid Enrollment)</option>
                  <option value={10}>10 Images (Recommended)</option>
                  <option value={15}>15 Images (High Precision)</option>
                </select>
              </div>
            </div>

            {/* Scientific Architecture Notice */}
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 text-indigo-400 mt-0.5" />
              <span>
                Extracts normalized spatial embeddings into the active vision registry, allowing immediate participation in replenishment prioritization and planogram audits.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading || !skuName.trim()}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 flex items-center gap-1.5 transition-all disabled:opacity-40"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{loading ? 'Enrolling & Extracting...' : 'Enroll Product'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

