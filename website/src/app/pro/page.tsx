'use client'

import { useState } from 'react'

const specialties = ['Family-Based', 'H-1B & Work', 'Asylum/Refugee', 'Green Card', 'Citizenship']

const professionals = [
  {
    id: '1',
    name: 'Maria Rodriguez, Esq.',
    title: 'Immigration Attorney',
    firm: 'Rodriguez & Associates',
    bar: 'CA Bar, AILA Member',
    specialties: ['Business Immigration', 'H-1B', 'L-1'],
    languages: ['English', 'Spanish'],
    responseRate: '24h avg response',
    verified: true,
  },
  {
    id: '2',
    name: 'James Chen, J.D.',
    title: 'Immigration Consultant',
    firm: 'Chen Immigration Services',
    bar: 'NY Bar',
    specialties: ['Family-Based', 'Adjustment of Status'],
    languages: ['English', 'Mandarin'],
    responseRate: '12h avg response',
    verified: true,
  },
  {
    id: '3',
    name: 'Priya Sharma, Esq.',
    title: 'Immigration Attorney',
    firm: 'Sharma Law Group',
    bar: 'TX Bar, AILA Member',
    specialties: ['EB-1', 'EB-2 NIW', 'Investment Visas'],
    languages: ['English', 'Hindi'],
    responseRate: '48h avg response',
    verified: true,
  },
]

export default function AskProPage() {
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([])
  const [question, setQuestion] = useState('')

  const toggleSpecialty = (specialty: string) => {
    setSelectedSpecialties((prev) =>
      prev.includes(specialty)
        ? prev.filter((s) => s !== specialty)
        : [...prev, specialty]
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-margin-desktop py-8">
      {/* Hero Section */}
      <div className="text-center mb-10">
        <h1 className="text-display-lg md:text-headline-lg text-primary mb-2">
          Ask an Immigration Pro
        </h1>
        <p className="text-body-lg text-on-surface-variant max-w-2xl mx-auto">
          Get expert answers from verified immigration attorneys and consultants.
        </p>
      </div>

      {/* Question Form */}
      <div className="max-w-3xl mx-auto mb-12">
        <div className="card">
          <label className="text-label-md text-on-surface font-medium mb-2 block">
            Describe your situation
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Describe your immigration situation in a few sentences..."
            rows={4}
            className="input-lg resize-none mb-4"
          />

          <label className="text-label-md text-on-surface font-medium mb-2 block">
            Select relevant case types
          </label>
          <div className="flex flex-wrap gap-2 mb-6">
            {specialties.map((specialty) => (
              <button
                key={specialty}
                onClick={() => toggleSpecialty(specialty)}
                className={selectedSpecialties.includes(specialty) ? 'pill-active' : 'pill'}
              >
                {specialty}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-lg mb-6">
            <span className="material-symbols-outlined text-secondary">verified_user</span>
            <p className="text-caption text-on-surface-variant">
              Your question will only be shared with verified immigration professionals.
            </p>
          </div>

          <button className="btn-primary w-full" disabled={!question.trim()}>
            Submit Question
          </button>
        </div>
      </div>

      {/* Verified Professionals */}
      <div className="mb-8">
        <h2 className="text-headline-md text-on-surface mb-2">Verified Professionals</h2>
        <p className="text-body-md text-on-surface-variant mb-6">
          All professionals are verified and licensed to practice immigration law.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {professionals.map((pro) => (
            <div key={pro.id} className="card-hover">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-primary-container flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-[28px]">person</span>
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <h3 className="text-label-md font-semibold text-on-surface">{pro.name}</h3>
                    {pro.verified && (
                      <span className="material-symbols-outlined text-secondary text-[16px]">verified</span>
                    )}
                  </div>
                  <p className="text-caption text-on-surface-variant">{pro.title}</p>
                  <p className="text-caption text-on-surface-variant">{pro.firm}</p>
                  <p className="text-caption text-outline">{pro.bar}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mb-3">
                {pro.specialties.map((spec) => (
                  <span key={spec} className="text-caption text-primary bg-primary-fixed px-2 py-0.5 rounded">
                    {spec}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between text-caption text-on-surface-variant">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">translate</span>
                  {pro.languages.join(', ')}
                </span>
                <span className="flex items-center gap-1 text-secondary">
                  <span className="material-symbols-outlined text-[14px]">schedule</span>
                  {pro.responseRate}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Professional Standard Guarantee */}
      <div className="bg-surface-container-low rounded-xl p-6 text-center max-w-3xl mx-auto">
        <span className="material-symbols-outlined text-[48px] text-primary mb-2">shield</span>
        <h3 className="text-headline-md text-on-surface mb-2">Professional Standard Guarantee</h3>
        <p className="text-body-md text-on-surface-variant">
          All professionals on Proceedings are verified members of AILA or equivalent bar associations.
          Responses are confidential and protected by attorney-client privilege where applicable.
        </p>
      </div>
    </div>
  )
}
