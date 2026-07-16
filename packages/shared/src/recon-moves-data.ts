export type ReconMove = {
  name: string;
  summary: string;
};

export const RECON_MOVES: ReconMove[] = [];

export function replaceReconMovesCatalog(moves: ReconMove[]): void {
  RECON_MOVES.length = 0;
  RECON_MOVES.push(...moves);
}
