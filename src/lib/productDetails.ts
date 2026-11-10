/** تحويل نص التفاصيل العامة إلى صفوف: «الخاصية: القيمة» أو سطر حر بدون خاصية */
export function parseDetailLines(text: string | null | undefined): { label: string | null; value: string }[] {
  return (text ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^([^:：]{1,60})[:：]\s*(.+)$/);
      return m ? { label: m[1].trim(), value: m[2].trim() } : { label: null, value: line };
    });
}
