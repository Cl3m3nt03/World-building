import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { documentKeys } from "@/features/cards";
import { commands } from "@/lib/bindings";
import { unwrap } from "@/lib/ipc";

/** Pause after the last key before searching, in milliseconds. */
const SEARCH_DELAY_MS = 120;

/**
 * The documents matching `query`, searched as it is typed (under the
 * documents' key: any change to a document refreshes it). The previous
 * results stay shown while the next ones come.
 */
export function useSearch(query: string) {
  const [searched, setSearched] = useState(query.trim());
  useEffect(() => {
    const timer = setTimeout(() => setSearched(query.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);
  const results = useQuery({
    queryKey: [...documentKeys.all(), "search", searched],
    queryFn: () => unwrap(commands.searchDocuments(searched)),
    enabled: searched !== "",
    placeholderData: keepPreviousData,
  });
  return { ...results, searched };
}
