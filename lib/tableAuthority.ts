// The table's authority panel: who may change which rule, and the ron rules themselves.
// Roles are major arcana. Changes are logged and take effect from the next hand, so a hand in
// progress is never re-ruled.

export type RonFrom = 'any' | 'kamicha';
export type RonRules = {
  ron: boolean; from: RonFrom; furiten: boolean; silentOnly: boolean;
  hanAdjust: number; multi: 'atamahane' | 'double'; tsumoBonus: boolean;
};
export const DEFAULT_RULES: RonRules = { ron: false, from: 'any', furiten: true, silentOnly: false, hanAdjust: 0, multi: 'atamahane', tsumoBonus: false };

export type Role = 'emperor' | 'hierophant' | 'magician' | 'fool';
export const ROLES: Record<Role, { card: string; name: string; can: string; edits: (keyof RonRules)[] }> = {
  emperor: { card: 'IV', name: '皇帝（卓の主）', can: 'すべての規則を変えられる', edits: ['ron', 'from', 'furiten', 'silentOnly', 'hanAdjust', 'multi', 'tsumoBonus'] },
  hierophant: { card: 'V', name: '教皇（審判）', can: 'ロンの条件だけ変えられる（ロンの有無は変えられない）', edits: ['from', 'furiten', 'silentOnly', 'multi'] },
  magician: { card: 'I', name: '魔術師（打ち手）', can: '点数の補正だけ変えられる', edits: ['hanAdjust', 'tsumoBonus'] },
  fool: { card: '0', name: '愚者（観戦）', can: '見るだけ', edits: [] },
};

export const RULE_LABEL: Record<keyof RonRules, string> = {
  ron: 'ロンあり', from: 'ロンできる相手', furiten: 'フリテン', silentOnly: '沈黙の行の最中だけロン', hanAdjust: 'ロンの翻の補正', multi: '同時ロン', tsumoBonus: 'ツモに +1',
};

export const canEdit = (role: Role, key: keyof RonRules) => ROLES[role].edits.includes(key);

export function describe(r: RonRules) {
  if (!r.ron) return 'ロンなし（ツモのみ）';
  return [
    r.from === 'any' ? '誰の捨て札でも' : '上家の捨て札だけ',
    r.furiten ? 'フリテンあり' : 'フリテンなし',
    r.silentOnly ? '沈黙の行の最中だけ' : '',
    r.hanAdjust ? `翻 ${r.hanAdjust > 0 ? '+' : ''}${r.hanAdjust}` : '',
    r.multi === 'atamahane' ? '頭ハネ' : 'ダブロン可',
    r.tsumoBonus ? 'ツモ +1' : '',
  ].filter(Boolean).join('・');
}
