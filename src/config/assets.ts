import { AssetMetadata } from '../logic/types';

export const ASSET_METADATA: AssetMetadata[] = [
  { symbol: 'CBA.AX', sector: 'Financials' },
  { symbol: 'NAB.AX', sector: 'Financials' },
  { symbol: 'WBC.AX', sector: 'Financials' },
  { symbol: 'RIO.AX', sector: 'Materials' },
  { symbol: 'BHP.AX', sector: 'Materials' },
  { symbol: 'FMG.AX', sector: 'Materials' },
  { symbol: 'CDA.AX', sector: 'Information Technology' },
  { symbol: 'WJL.AX', sector: 'Materials' }, // Wiluna Mining (Materials/Mining)
];

/**
 * Convenience Map for O(1) lookup
 */
export const ASSET_METADATA_MAP = new Map<string, AssetMetadata>(
  ASSET_METADATA.map(a => [a.symbol, a])
);
