'use client'

import { useState } from 'react'

const news = [
  {
    id: '1',
    category: 'USCIS',
    date: 'May 28, 2024',
    title: 'USCIS Updates EB-2 NIW Guidance for STEM Professionals',
    description: 'New policy clarifies national interest waiver criteria for STEM researchers and entrepreneurs.',
    relevance: 'Relevant to your EB-2 NIW interest',
    image: true,
  },
  {
    id: '2',
    category: 'DOL',
    date: 'May 25, 2024',
    title: 'Department of Labor Proposes New PERM Processing Timelines',
    description: 'Proposed rule aims to reduce PERM labor certification backlogs by Q4 2024.',
    relevance: 'Relevant to your H-1B to Green Card pathway',
    image: false,
  },
  {
    id: '3',
    category: 'White House',
    date: 'May 20, 2024',
    title: 'Executive Order on High-Skilled Immigration Reform',
    description: 'New executive action addresses visa caps and processing improvements for employment-based categories.',
    relevance: null,
    image: false,
  },
]

const trendingTopics = ['#H1BLottery', '#EB2Retrogression', '#STEM', '#VisaBulletin', '#F1toH1B']

const filters = ['Latest', 'USCIS', 'Labor Dept', 'State Dept', 'Congress']

export default function NewsPage() {
  const [activeFilter, setActiveFilter] = useState('Latest')
  const [policyOnly, setPolicyOnly] = useState(false)

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-margin-desktop py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-headline-lg text-primary mb-2">Tailored News</h1>
        <p className="text-body-md text-on-surface-variant">
          Immigration updates curated for your profile.
        </p>
      </div>

      {/* Smart Feed Banner */}
      <div className="bg-primary-container rounded-xl p-4 mb-6 flex items-center gap-3">
        <span className="material-symbols-outlined text-on-primary-container">auto_awesome</span>
        <p className="text-body-md text-on-primary-container">
          <span className="font-semibold">Smart Feed Active:</span> Showing H-1B & EB-2 related updates based on your profile.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={activeFilter === filter ? 'pill-active whitespace-nowrap' : 'pill whitespace-nowrap'}
            >
              {filter}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-label-md text-on-surface-variant">Policy changes only</span>
          <button
            onClick={() => setPolicyOnly(!policyOnly)}
            className={policyOnly ? 'toggle-on' : 'toggle-off'}
          >
            <span className={`toggle-knob ${policyOnly ? 'translate-x-5' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* News Feed */}
        <div className="flex-1 space-y-4">
          {news.map((item) => (
            <article key={item.id} className="card-hover">
              <div className="flex items-center gap-2 mb-2">
                <span className="badge-primary">{item.category}</span>
                <span className="text-caption text-outline">{item.date}</span>
              </div>

              <h2 className="text-body-lg font-semibold text-primary mb-2 hover:underline cursor-pointer">
                {item.title}
              </h2>
              <p className="text-body-md text-on-surface-variant mb-3">
                {item.description}
              </p>

              {item.relevance && (
                <div className="flex items-center gap-2 text-caption text-secondary">
                  <span className="material-symbols-outlined text-[16px]">trending_up</span>
                  {item.relevance}
                </div>
              )}

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-outline-variant">
                <button className="text-caption text-on-surface-variant hover:text-primary flex items-center gap-1 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">bookmark_border</span>
                  Save
                </button>
                <button className="text-caption text-primary flex items-center gap-1 hover:underline">
                  Read Analysis
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
            </article>
          ))}

          <button className="w-full py-3 text-label-md text-primary border border-outline-variant rounded-xl hover:bg-surface-container transition-colors">
            Load older updates
          </button>
        </div>

        {/* Sidebar */}
        <aside className="lg:w-80 space-y-6">
          {/* Trending Topics */}
          <div className="card">
            <h3 className="text-label-md font-semibold text-on-surface mb-3">Trending Topics</h3>
            <div className="flex flex-wrap gap-2">
              {trendingTopics.map((topic) => (
                <button
                  key={topic}
                  className="text-body-md text-primary hover:underline"
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          {/* Profile Match */}
          <div className="card">
            <h3 className="text-label-md font-semibold text-on-surface mb-3">Profile Match</h3>
            <p className="text-body-md text-on-surface-variant mb-3">
              Your news feed is <span className="font-semibold text-secondary">92% relevant</span> to your immigration profile.
            </p>
            <div className="w-full bg-surface-container rounded-full h-2 mb-3">
              <div className="bg-secondary h-2 rounded-full" style={{ width: '92%' }} />
            </div>
            <button className="text-caption text-primary hover:underline">
              Update your profile preferences
            </button>
          </div>

          {/* Featured Guide */}
          <div className="relative rounded-xl overflow-hidden">
            <div className="bg-gradient-to-br from-primary to-primary-container p-6">
              <span className="badge bg-white/20 text-white mb-3">Featured Guide</span>
              <h3 className="text-headline-md text-on-primary mb-2">
                H-1B to Green Card: Complete 2024 Guide
              </h3>
              <p className="text-body-md text-on-primary opacity-80 mb-4">
                Step-by-step guidance for employment-based immigration.
              </p>
              <button className="btn-primary bg-white text-primary hover:bg-surface">
                Read Guide
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
