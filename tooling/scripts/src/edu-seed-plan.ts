/*
 * Namuna ma'lumot sanalari (pnpm edu:seed): faqat joriy va o'tgan oy. 20 ta o'quvchidan 3 tasi o'tgan oydan (2 oylik),
 * qolganlari joriy oydan; qo'shilish va faollashtirish — oy boshi yoki o'rtasi (joriy oyda o'rtasi bugundan o'tmaydi).
 * Oxirgi 4 tasi sinovda (faollashtirilmagan). O'quvchi i — guruh i da, har 4-chisi qo'shimcha (i+7)-guruhda.
 */

export const SEED_STUDENTS = 20;
export const SEED_GROUPS = 20;

function prevMonth(month: string) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export function seedPlan(today: string) {
  const cur = today.slice(0, 7);
  const prev = prevMonth(cur);
  const curMid = today.slice(8) >= "15" ? `${cur}-15` : today;
  const students = Array.from({ length: SEED_STUDENTS }, (_, i) => {
    const twoMonth = i < 3;
    return {
      trial: i >= SEED_STUDENTS - 4,
      start: twoMonth ? (i % 2 ? `${prev}-15` : `${prev}-01`) : i % 2 ? curMid : `${cur}-01`,
      groups: [i, ...(i % 4 === 0 ? [(i + 7) % SEED_GROUPS] : [])],
    };
  });
  // Guruh boshlanishi — a'zolaridan eng erta oy boshi
  const groupStart = Array.from({ length: SEED_GROUPS }, (_, g) => {
    const starts = students.filter((s) => s.groups.includes(g)).map((s) => s.start.slice(0, 7));
    return `${starts.sort()[0] ?? cur}-01`;
  });
  return { students, groupStart };
}
