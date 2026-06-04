'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const steps = [
  { id: 1, label: 'Situation', icon: 'description' },
  { id: 2, label: 'Origin', icon: 'public' },
  { id: 3, label: 'Timeline', icon: 'schedule' },
]

const pathways = [
  'Family-Based Immigration',
  'Employment-Based (H-1B, L-1)',
  'Student (F-1, J-1)',
  'Asylum / Refugee',
  'Investment (EB-5)',
  'Other / Not Sure',
]

const stages = [
  'Researching / Just Starting',
  'Preparing to File',
  'Waiting for Decision',
  'Preparing for Interview',
  'Appeal / RFE Response',
]

const countries = [
  'India',
  'China',
  'Mexico',
  'Philippines',
  'Other',
]

const timelines = [
  'As soon as possible',
  'Within 6 months',
  'Within 1 year',
  'No specific timeline',
]

export default function OnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    pathway: '',
    stage: '',
    country: '',
    timeline: '',
  })

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1)
    } else {
      // Complete onboarding
      router.push('/search')
    }
  }

  const canProceed = () => {
    if (currentStep === 1) return formData.pathway && formData.stage
    if (currentStep === 2) return formData.country
    if (currentStep === 3) return formData.timeline
    return false
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-4 py-8">
      {/* Stepper */}
      <div className="flex items-center gap-4 mb-10">
        {steps.map((step, idx) => (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  step.id <= currentStep
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                {step.id < currentStep ? (
                  <span className="material-symbols-outlined text-[20px]">check</span>
                ) : (
                  <span className="material-symbols-outlined text-[20px]">{step.icon}</span>
                )}
              </div>
              <span className={`text-caption mt-1 ${
                step.id <= currentStep ? 'text-primary' : 'text-on-surface-variant'
              }`}>
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`w-16 h-0.5 mx-2 ${
                step.id < currentStep ? 'bg-primary' : 'bg-outline-variant'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Form Card */}
      <div className="card max-w-lg w-full">
        <h1 className="text-headline-md text-on-surface mb-2">
          {currentStep === 1 && 'Personalize your journey'}
          {currentStep === 2 && 'Where are you from?'}
          {currentStep === 3 && 'What\'s your timeline?'}
        </h1>
        <p className="text-body-md text-on-surface-variant mb-6">
          {currentStep === 1 && 'Help us understand your immigration situation.'}
          {currentStep === 2 && 'This helps us show relevant processing times.'}
          {currentStep === 3 && 'We\'ll prioritize information based on your needs.'}
        </p>

        {/* Step 1: Situation */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <label className="text-label-md text-on-surface font-medium mb-2 block">
                Immigration Pathway
              </label>
              <select
                value={formData.pathway}
                onChange={(e) => setFormData({ ...formData, pathway: e.target.value })}
                className="input"
              >
                <option value="">Select your pathway</option>
                {pathways.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-label-md text-on-surface font-medium mb-2 block">
                Current Stage
              </label>
              <select
                value={formData.stage}
                onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                className="input"
              >
                <option value="">Select your stage</option>
                {stages.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Step 2: Origin */}
        {currentStep === 2 && (
          <div>
            <label className="text-label-md text-on-surface font-medium mb-2 block">
              Country of Origin
            </label>
            <select
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              className="input"
            >
              <option value="">Select your country</option>
              {countries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}

        {/* Step 3: Timeline */}
        {currentStep === 3 && (
          <div className="space-y-2">
            {timelines.map((t) => (
              <button
                key={t}
                onClick={() => setFormData({ ...formData, timeline: t })}
                className={`w-full text-left p-4 rounded-lg border transition-all ${
                  formData.timeline === t
                    ? 'border-primary bg-primary-fixed'
                    : 'border-outline-variant hover:border-primary'
                }`}
              >
                <span className="text-body-md text-on-surface">{t}</span>
              </button>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={() => router.push('/search')}
            className="text-label-md text-on-surface-variant hover:text-primary transition-colors"
          >
            Skip for now
          </button>
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className="btn-primary flex items-center gap-2"
          >
            {currentStep === 3 ? 'Get Started' : 'Continue'}
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>

      {/* Privacy Assurance */}
      <div className="flex items-center gap-2 mt-6 text-caption text-on-surface-variant">
        <span className="material-symbols-outlined text-secondary text-[18px]">shield</span>
        Your information is private and used only to personalize your experience.
      </div>
    </div>
  )
}
