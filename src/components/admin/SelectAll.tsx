'use client';

/** مربع «تحديد الكل» لكل خانات name=ids داخل نفس النموذج */
export default function SelectAll() {
  return (
    <input
      type="checkbox"
      aria-label="تحديد الكل"
      onChange={(e) => {
        const form = e.currentTarget.closest('form');
        form?.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((c) => (c.checked = e.currentTarget.checked));
      }}
    />
  );
}
