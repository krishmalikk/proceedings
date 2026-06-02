'use client'

import { useState } from 'react'
import Link from 'next/link'

const mockResults = [
  {
    id: '1',
    title: 'I-485 RFE Response: Missing Birth Certificate',
    matchPercent: 94,
    verified: true,
    tags: ['I-485', 'Adjustment of Status', 'RFE'],
    similarCases: 12,
  },
  {
    id: '2',
    title: 'H-1B to Green Card: PERM Labor Certification',
    matchPercent: 87,
    verified: true,
    tags: ['H-1B', 'EB-2', 'PERM'],
    similarCases: 8,
  },
  {
    id: '3',
    title: 'F-1 OPT Extension While H-1B Pending',
    matchPercent: 82,
    verified: false,
    tags: ['F-1', 'OPT', 'H-1B', 'Cap Gap'],
    similarCases: 15,
  },
]

const visaTypes = ['All Types', 'H-1B', 'F-1', 'L-1', 'EB-1', 'EB-2', 'EB-3', 'Family-Based']
const stages = ['All Stages', 'RFE Response', 'Initial Filing', 'Interview', 'Appeal']

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVisaType, setSelectedVisaType] = useState('All Types')
  const [selectedStage, setSelectedStage] = useState('All Stages')
  const [resolvedOnly, setResolvedOnly] = useState(true)

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-margin-desktop py-8">
      {/* Hero Section */}
      <div className="text-center mb-8">
        <h1 className="text-display-lg md:text-headline-lg text-primary mb-2">
          Find precedents in seconds.
        </h1>
        <p className="text-body-md text-on-surface-variant">
          Search resolved immigration cases to find strategies that worked.
        </p>
      </div>

      {/* Search Input */}
      <div className="max-w-3xl mx-auto mb-8">
        <div className="relative flex items-center bg-surface-container-lowest border border-outline-variant rounded-xl focus-within:border-primary transition-all">
          <span className="material-symbols-outlined text-on-surface-variant ml-4">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Describe your immigration situation..."
            className="flex-1 px-4 py-4 bg-transparent border-none focus:ring-0 focus:outline-none text-body-lg text-on-surface"
          />
          <button className="btn-primary mr-2 my-2">
            Find Matches
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Filters Sidebar */}
        <aside className="md:w-64 space-y-6">
          {/* Visa Type */}
          <div>
            <label className="text-label-md text-on-surface font-medium mb-2 block">Visa Type</label>
            <select
              value={selectedVisaType}
              onChange={(e) => setSelectedVisaType(e.target.value)}
              className="input"
            >
              {visaTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Application Stage */}
          <div>
            <label className="text-label-md text-on-surface font-medium mb-2 block">Application Stage</label>
            <div className="flex flex-wrap gap-2">
              {stages.map((stage) => (
                <button
                  key={stage}
                  onClick={() => setSelectedStage(stage)}
                  className={selectedStage === stage ? 'pill-active' : 'pill'}
                >
                  {stage}
                </button>
              ))}
            </div>
          </div>

          {/* Resolved Only Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-label-md text-on-surface">Resolved cases only</span>
            <button
              onClick={() => setResolvedOnly(!resolvedOnly)}
              className={resolvedOnly ? 'toggle-on' : 'toggle-off'}
            >
              <span className={`toggle-knob ${resolvedOnly ? 'translate-x-5' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Pro Tip */}
          <div className="bg-surface-container-low rounded-xl p-4">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-secondary">lightbulb</span>
              <div>
                <p className="text-label-md font-medium text-on-surface">Pro Tip</p>
                <p className="text-caption text-on-surface-variant mt-1">
                  Include your visa type and specific issue for more accurate matches.
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <p className="text-label-md text-on-surface-variant">
              {mockResults.length} cases found
            </p>
            <select className="input w-auto py-2 px-3">
              <option>Most Relevant</option>
              <option>Most Recent</option>
              <option>Most Helpful</option>
            </select>
          </div>

          <div className="space-y-4">
            {mockResults.map((result) => (
              <Link
                key={result.id}
                href={`/case/${result.id}`}
                className="card-hover block"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="badge-primary">{result.matchPercent}% match</span>
                    {result.verified && (
                      <span className="badge-secondary flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">verified</span>
                        Attorney Verified
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="text-headline-md text-on-surface hover:text-primary transition-colors mb-2">
                  {result.title}
                </h3>

                <div className="flex flex-wrap gap-2 mb-3">
                  {result.tags.map((tag) => (
                    <span key={tag} className="text-caption text-on-surface-variant bg-surface-container px-2 py-1 rounded">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between text-caption text-on-surface-variant">
                  <span>{result.similarCases} similar cases</span>
                  <span className="flex items-center gap-1 text-primary">
                    View Case Analysis
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
