# ADR 0072: Sawmill — Yuk chiqarish, yuk mashinalari, zakazlar va eslatmalar (S4)

- **Holat:** Qabul qilindi
- **Sana:** 2026-10-24
- **Muallif:** Ventura jamoasi
- **Bog'liq hujjatlar:** [docs/SAWMILL-PLAN.md](file:///home/warcassa/Projects/Ventura/docs/SAWMILL-PLAN.md), [docs/SAWMILL-TAHLIL.md](file:///home/warcassa/Projects/Ventura/docs/SAWMILL-TAHLIL.md), [ADR 0068](file:///home/warcassa/Projects/Ventura/docs/decisions/0068-sawmill-shabloni-va-arxitekturasi.md), [ADR 0070](file:///home/warcassa/Projects/Ventura/docs/decisions/0070-sawmill-teraklar-ombor-xarajatlar.md), [ADR 0071](file:///home/warcassa/Projects/Ventura/docs/decisions/0071-sawmill-ishlar-va-ish-haqi.md)

---

## 1. Kontekst va Muammo

Eski Flutter ilovasida yuk chiqarish va zakazlar boshqaruvida quyidagi jiddiy muammolar bo'lgan:
1. **Yuk mashinasi xarajati ishchilarga to'lov bo'lib ketishi (K5):** Yuk chiqarishda mashina tanlansa, mashina summasi ishchilarga to'lov sifatida yozilgan, natijada ishchilar balansi noo'rin kamayib, terak xarajatiga kirmagan.
2. **Kubdan aylantirishdagi kasr va qoldiq xatolari (SAWMILL-TAHLIL 9):** Kubda kiritilganda kasr yaxlitlashlari sababli omborda qoldiq bilan aynan mos kelmay qolish, yoki `totalAmount` saqlangandan keyin o'zgarib ketishi.
3. **Omborda yo'q miqdorni chiqarish:** Manfiy qoldiqqa ruxsat berish yoki noaniq xatoliklar.
4. **Zakazlar tahrirlanganda eslatma bayroqlari tushib qolishi (K20):** Zakaz tahrirlanganda `readyNotifiedAt` va `dueNotifiedAt` bayroqlari tozalangan va bir xil eslatma qayta-qayta chiqqan.
5. **Yuk chiqarish bekor qilinganda ombor tiklanmasligi:** Chiqarilgan material va uning yuk mashina xarajati bekor qilinganda kaskad to'liq tiklanmagan.

---

## 2. Qabul qilingan qarorlar

### 2.1. Sof hisob-kitob modullari (`lib/calc/dispatch.ts` va `lib/calc/orders.ts`)
- `validateAndCalculateDispatch`:
  - Dona yoki kubda kiritish mumkin. Kubda kiritilganda `volumeM3` orqali donaga aylanadi: `quantityPiece = Math.round((quantityInput / volumeM3) * 10000) / 10000`.
  - Jami summa: `totalAmount = Math.round(quantityInput * priceInput)`.
  - 1 dona ekvivalent narxi: `unitPricePiece = Math.round(totalAmount / quantityPiece)` — har doim `quantityPiece * unitPricePiece` umumiy summaga mos keladi.
  - **Epsilon tekshiruvi (`ε = 0.000001`):**
    - Qoldiq $\le \epsilon$ bo'lsa $\to$ `OUT_OF_STOCK` xatosi.
    - Qoldiq $+ \epsilon < \text{miqdor}$ bo'lsa $\to$ `INSUFFICIENT_STOCK` xatosi.
    - $|\text{miqdor} - \text{qoldiq}| < \epsilon$ bo'lsa $\to$ miqdor aynan qoldiqqa tenglashtiriladi (kasr yaxlitlash xatosini oldini olish).
- `convertDispatchPrice`:
  - Dona $\to$ Kub: `cubePrice ?? currentPrice / volumeM3`
  - Kub $\to$ Dona: `sellingPrice ?? currentPrice * volumeM3`
- `getOrderStatus`:
  - `completedAt` bo'lsa $\to$ `"completed"` (Bajarildi)
  - Ombordagi qoldiq $\ge$ zakaz miqdori bo'lsa $\to$ `"ready"` (Tayyor)
  - Aks holda $\to$ `"pending"` (Kutilmoqda)
- `isOrderDueSoon`: Topshirish muddati bugungi kundan hisoblanganda $\le 2$ kun qolgan (yoki muddati o'tgan) zakazlarni aniqlaydi.
- `findPendingOrderNotifications`: Har bir zakazga bir martadan "material tayyor" va "muddat yaqin" bildirishnomalarini shakllantiradi.

### 2.2. K5 qoidasi: Yuk mashinasi xarajati terak xarajatiga
- Yuk chiqarishda mashina tanlansa, u ishchilarga to'lov qilinmaydi!
- `terak_costs` jadvaliga `kind = "truck"`, `amount = truck.amount`, `dispatchId = dispatch.id` ko'rinishida terak xarajati sifatida yoziladi.
- Yuk chiqarish bekor qilinganda (`deleteDispatchAction`):
  - Chiqarilgan material soni `terak_materials.quantity` ga qaytariladi.
  - `stock_movements` harakati o'chiriladi.
  - Bog'langan yuk mashina xarajati (`terak_costs.dispatchId = dispatch.id`) avtomatik va to'liq o'chiriladi.

### 2.3. Zakazlar va K20 qoidasi (`/orders`)
- Zakaz qo'shish, ro'yxat, filtrlar (barcha/faol/bajarilgan, terak bo'yicha), qidiruv.
- Diqqat talab zakazlar (tayyor yoki muddati yaqin) alohida ogohlantirish blokida tezkor amallar bilan ko'rsatiladi.
- Bajarildi belgisi: bitta tugma bilan `completedAt` ni o'rnatish yoki bekor qilish.
- **K20 qarori:** Zakaz ma'lumotlari tahrirlanganda (`updateOrderAction`), `readyNotifiedAt` va `dueNotifiedAt` bayroqlari saqlanib qoladi va qayta bildirishnoma chiqmaydi.

### 2.4. Barcha summa inputlarida minglik ajratkich (`MoneyInput`)
- Foydalanuvchi talabiga asosan barcha summa va narx kiritish inputlarida `@ventura/ui/money-input` komponenti qo'llanildi.

---

## 3. Natijalar

- S4 to'liq amalga oshirildi, barcha qabul mezonlari bajarildi:
  - `/dispatch` sahifasi va `DispatchDialog`
  - `/orders` sahifasi va `OrderDialog`
  - `/teraks/[id]` sahifasidagi Yuk chiqarish va Zakazlar tablari to'liq ishga tushirildi
  - K5 va K20 qoidalari 100% integratsion testlar bilan qoplandi
- 20 ta test fayli, 73 ta test 100% muvaffaqiyatli o'tdi.
- `tsc --noEmit` va `eslint .` 0 ta xato bilan o'tdi.
- `next build` muvaffaqiyatli yakunlandi.
