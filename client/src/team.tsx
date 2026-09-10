import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useFetch } from "./useApi";
import type { Team } from "./types";

const STORE_KEY = "crmgold_team";

interface TeamCtx {
  teams: Team[];
  activeTeamId: string | null;
  activeTeam: Team | null;
  setActiveTeam: (id: string) => void;
  loading: boolean;
  reload: () => void;
}

const Ctx = createContext<TeamCtx>(null as any);
export const useTeam = () => useContext(Ctx);

export function TeamProvider({ children }: { children: ReactNode }) {
  const { data, loading, reload } = useFetch<Team[]>("/teams");
  const teams = data ?? [];

  const [activeTeamId, setActiveTeamId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORE_KEY);
    } catch {
      return null;
    }
  });

  // Once teams load, make sure the active id is a real one; default to the first.
  useEffect(() => {
    if (teams.length === 0) return;
    if (!activeTeamId || !teams.some((t) => t.id === activeTeamId)) {
      setActiveTeamId(teams[0].id);
    }
  }, [teams, activeTeamId]);

  const setActiveTeam = (id: string) => {
    setActiveTeamId(id);
    try {
      localStorage.setItem(STORE_KEY, id);
    } catch {
      /* ignore */
    }
  };

  const activeTeam = teams.find((t) => t.id === activeTeamId) ?? null;

  return (
    <Ctx.Provider
      value={{ teams, activeTeamId, activeTeam, setActiveTeam, loading, reload }}
    >
      {children}
    </Ctx.Provider>
  );
}
