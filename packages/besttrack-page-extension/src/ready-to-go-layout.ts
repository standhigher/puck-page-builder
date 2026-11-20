export const progressIdentityGap = 12;

/** 整卡居中要左右各留一列给语言按钮；按钮内缩后，左右列不够宽就改成上下布局。 */
export function shouldStackProgressIdentity(labelWidth: number, menuWidth: number, availableWidth: number, gap = progressIdentityGap, menuInset = 0) {
  if (availableWidth <= 0) return false;
  return labelWidth + 2 * (menuWidth + Math.max(0, menuInset)) + 2 * gap > availableWidth;
}
