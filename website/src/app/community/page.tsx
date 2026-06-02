'use client'

import { useState } from 'react'
import Link from 'next/link'

const categories = ['All Threads', 'H-1B Visa', 'F-1 Student', 'Green Card', 'Adjustment of Status', 'Family-Based']

const threads = [
  {
    id: '1',
    tags: ['H-1B', 'Form I-129', 'Pre-filing'],
    title: 'Timeline for H-1B approval after RFE response?',
    excerpt: 'I submitted my RFE response 3 weeks ago. Anyone have recent experience with processing times...',
    upvotes: 24,
    comments: 8,
    verified: true,
    time: '2h ago',
  },
  {
    id: '2',
    tags: ['Green Card', 'I-485', 'Interview'],
    title: 'What to expect at the AOS interview?',
    excerpt: 'My interview is scheduled for next month. Would appreciate any tips from those who have been through it...',
    upvotes: 45,
    comments: 15,
    verified: false,
    time: '5h ago',
  },
  {
    id: '3',
    tags: ['F-1', 'OPT', 'STEM Extension'],
    title: 'STEM OPT extension processing time in 2024',
    excerpt: 'Applied for STEM OPT extension last month. How long is it taking these days?',
    upvotes: 18,
    comments: 12,
    verified: true,
    time: '1d ago',
  },
]

const trending = [
  { id: '1', title: 'H-1B Lottery Results Thread', users: 234 },
  { id: '2', title: 'EB-2 NIW Approvals - Share Your Timeline', users: 156 },
  { id: '3', title: 'I-485 Processing Times Mega Thread', users: 89 },
]

export default function CommunityPage() {
  const [activeCategory, setActiveCategory] = useState('All Threads')

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-margin-desktop py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-headline-lg text-primary mb-2">Community Forum</h1>
        <p className="text-body-md text-on-surface-variant">
          Connect with others navigating the immigration process. Share experiences and get answers.
        </p>
      </div>

      {/* Category Pills */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-6 pb-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={activeCategory === cat ? 'pill-active whitespace-nowrap' : 'pill whitespace-nowrap'}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main Feed */}
        <div className="flex-1 space-y-4">
          {threads.map((thread) => (
            <Link key={thread.id} href={`/community/${thread.id}`} className="card-hover block">
              <div className="flex flex-wrap gap-2 mb-2">
                {thread.tags.map((tag) => (
                  <span key={tag} className="text-caption text-primary bg-primary-fixed px-2 py-0.5 rounded">
                    {tag}
                  </span>
                ))}
                <span className="text-caption text-outline">{thread.time}</span>
              </div>

              <h3 className="text-body-lg font-semibold text-on-surface mb-1 line-clamp-1">
                {thread.title}
              </h3>
              <p className="text-body-md text-on-surface-variant line-clamp-2 mb-3">
                {thread.excerpt}
              </p>

              <div className="flex items-center gap-4 text-caption text-on-surface-variant">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">thumb_up</span>
                  {thread.upvotes}
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">comment</span>
                  {thread.comments}
                </span>
                {thread.verified && (
                  <span className="flex items-center gap-1 text-secondary">
                    <span className="material-symbols-outlined text-[16px]">verified</span>
                    Helpful
                  </span>
                )}
              </div>
            </Link>
          ))}

          {/* Expert Spotlight */}
          <div className="bg-primary-container rounded-xl p-6 relative overflow-hidden">
            <span className="badge-primary mb-3">Expert Spotlight</span>
            <h3 className="text-headline-md text-on-primary-container mb-2">
              Live Q&A: H-1B Filing Season 2024
            </h3>
            <p className="text-body-md text-on-primary-container opacity-80 mb-4">
              Join immigration attorney Maria Rodriguez for a live session on H-1B prep.
            </p>
            <button className="btn-primary bg-white text-primary hover:bg-surface">
              Set Reminder
            </button>
            <span className="material-symbols-outlined absolute right-4 top-4 text-[80px] text-on-primary-container opacity-10">
              support_agent
            </span>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="lg:w-80 space-y-6">
          {/* Trending */}
          <div className="card">
            <h3 className="text-label-md font-semibold text-on-surface mb-4">Trending Discussions</h3>
            <div className="space-y-3">
              {trending.map((item, idx) => (
                <Link
                  key={item.id}
                  href={`/community/${item.id}`}
                  className="flex items-start gap-3 text-body-md text-on-surface hover:text-primary transition-colors"
                >
                  <span className="text-primary font-semibold">{idx + 1}</span>
                  <div>
                    <p className="line-clamp-2">{item.title}</p>
                    <p className="text-caption text-outline">{item.users} active users</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Ask CTA */}
          <div className="card text-center hidden lg:block">
            <span className="material-symbols-outlined text-[48px] text-primary mb-2">help</span>
            <h3 className="text-label-md font-semibold text-on-surface mb-2">Have a Question?</h3>
            <p className="text-caption text-on-surface-variant mb-4">
              Post your question and get answers from the community.
            </p>
            <button className="btn-primary w-full">Post a Question</button>
          </div>

          {/* Guidelines */}
          <div className="card">
            <h3 className="text-label-md font-semibold text-on-surface mb-3">Community Guidelines</h3>
            <ul className="space-y-2 text-caption text-on-surface-variant">
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-secondary">check</span>
                Be respectful and supportive
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-secondary">check</span>
                Share experiences, not legal advice
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-secondary">check</span>
                Protect personal information
              </li>
            </ul>
          </div>
        </aside>
      </div>

      {/* Mobile FAB */}
      <button className="fab md:hidden">
        <span className="material-symbols-outlined">edit</span>
      </button>
    </div>
  )
}
