import { useFocusEffect } from 'expo-router';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

import { apiFetch } from '@/lib/api';

/**
 * The pet, shared by the tab bar and the screens under it.
 *
 * The tab bar needs two things the tabs themselves also need: which species to
 * draw, and how many decisions are waiting. Fetching it in both places would mean
 * two requests and two answers that can disagree, so it's fetched once here.
 *
 * Refreshed on focus rather than polled: a pet acts about once an hour, so a
 * timer would spend battery to learn nothing.
 */

type Summary = {
  species: string | null;
  name: string | null;
  /** Decisions waiting on an answer — what the tab badge counts. */
  pendingAsks: number;
  refresh: () => void;
};

const PetSummaryContext = createContext<Summary>({
  species: null,
  name: null,
  pendingAsks: 0,
  refresh: () => {},
});

export function PetSummaryProvider({ children }: { children: ReactNode }) {
  const [species, setSpecies] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [pendingAsks, setPendingAsks] = useState(0);

  const refresh = useCallback(() => {
    apiFetch<{ pet: { name: string; species: string } | null }>('/api/pets')
      .then((r) => {
        setSpecies(r.pet?.species ?? null);
        setName(r.pet?.name ?? null);
      })
      .catch(() => {});
    apiFetch<{ actions: { status: string }[] }>('/api/me/pet-actions')
      .then((r) => setPendingAsks(r.actions.filter((a) => a.status === 'pending').length))
      .catch(() => {});
  }, []);

  useFocusEffect(refresh);

  return (
    <PetSummaryContext.Provider value={{ species, name, pendingAsks, refresh }}>
      {children}
    </PetSummaryContext.Provider>
  );
}

export const usePetSummary = () => useContext(PetSummaryContext);
