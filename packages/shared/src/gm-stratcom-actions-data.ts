export type GmStratcomAction = {
  name: string;
  summary: string;
};

export const GM_STRATCOM_ACTIONS: GmStratcomAction[] = [];

export function replaceGmStratcomActionsCatalog(actions: GmStratcomAction[]): void {
  GM_STRATCOM_ACTIONS.length = 0;
  GM_STRATCOM_ACTIONS.push(...actions);
}
