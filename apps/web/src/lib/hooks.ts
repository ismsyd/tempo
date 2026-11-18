import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { DEFAULT_SETTINGS, addDays, fromISODate, startOfWeek, toISODate, type Settings } from "@tempo/shared";
import { getSettings, saveSettings } from "./api";

export function useSettings() {
  const q = useQuery({ queryKey: ["settings"], queryFn: getSettings, staleTime: Infinity });
  return q.data ?? DEFAULT_SETTINGS;
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Settings>) => saveSettings(patch),
    onMutate: async (patch) => {
      const prev = qc.getQueryData<Settings>(["settings"]);
      qc.setQueryData<Settings>(["settings"], { ...(prev ?? DEFAULT_SETTINGS), ...patch });
      return { prev };
    },
    onError: (_e, _p, ctx) => ctx?.prev && qc.setQueryData(["settings"], ctx.prev),
    onSettled: () => qc.invalidateQueries(),
  });
}

/** The selected week lives in the URL (?week=YYYY-MM-DD) so it survives navigation. */
export function useWeekParam() {
  const settings = useSettings();
  const [params, setParams] = useSearchParams();
  const current = startOfWeek(Date.now(), settings.weekStartsOn);
  const raw = params.get("week");
  let weekStart = raw ? startOfWeek(fromISODate(raw), settings.weekStartsOn) : current;
  if (weekStart > current) weekStart = current;
  const iso = toISODate(weekStart);
  const set = (ts: number) => {
    const next = new URLSearchParams(params);
    if (ts >= current) next.delete("week");
    else next.set("week", toISODate(ts));
    setParams(next, { replace: true });
  };
  return {
    weekStart,
    iso,
    isCurrent: weekStart === current,
    prev: () => set(addDays(weekStart, -7)),
    next: () => set(addDays(weekStart, 7)),
    query: raw && weekStart !== current ? `?week=${iso}` : "",
  };
}
