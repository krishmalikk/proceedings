import { useEffect, useState } from 'react';
import { getPosting } from '../services/apiService';

export interface ExperienceFacets {
  visa: string[];
  consulates: string[];
  outcome: string;
  tags: string[];
  date: string;
}

interface JourneyLike {
  experience_case_id?: string;
}

// Mirrors the website onboarding page: for each SHARED/published journey entry
// (one with an `experience_case_id`), lazily fetch that experience's posting and
// expose its generated facets (visa / consulates / outcome / tags) keyed by id.
// Best-effort - failures are skipped, never thrown.
export function useExperienceFacets(journey: JourneyLike[] | undefined): Record<string, ExperienceFacets> {
  const [facets, setFacets] = useState<Record<string, ExperienceFacets>>({});

  useEffect(() => {
    const ids = (journey || [])
      .map((e) => e.experience_case_id)
      .filter((id): id is string => !!id);
    const missing = ids.filter((id) => !(id in facets));
    if (missing.length === 0) return;

    let cancelled = false;
    Promise.all(
      missing.map((id) =>
        getPosting(id)
          .then((d) => [id, d] as const)
          .catch(() => [id, null] as const)
      )
    ).then((pairs) => {
      if (cancelled) return;
      setFacets((prev) => {
        const next = { ...prev };
        for (const [id, d] of pairs) {
          if (d) {
            next[id] = {
              visa: d.visa || [],
              consulates: d.consulates || [],
              outcome: d.outcome || '',
              tags: d.tags || [],
              date: d.date || '',
            };
          }
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey]);

  return facets;
}
