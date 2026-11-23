import { getItemsFiltered, Item } from './api';
import { itemMatchesCandidates, parseScan, ParsedScan } from './barcode';

/**
 * Find the single active product a scanned code refers to (exact SKU or barcode match).
 * The catalog search is a substring match, so results are filtered down to exact hits here.
 * Candidates are tried in order, and the lookup stops at the first hit.
 */
export async function findItemByScan(
  scan: ParsedScan | string,
  options: { activeOnly?: boolean; localItems?: Item[] } = {},
): Promise<Item | null> {
  const parsed = typeof scan === 'string' ? parseScan(scan) : scan;
  const { activeOnly = true, localItems = [] } = options;

  const local = localItems.find((i) => itemMatchesCandidates(i, parsed.candidates));
  if (local) return local;

  for (const candidate of parsed.candidates) {
    const res = await getItemsFiltered(candidate, '', '', activeOnly, 1, 50);
    const hit = res.items.find((i) => itemMatchesCandidates(i, parsed.candidates));
    if (hit) return hit;
  }
  return null;
}
