export const timeSlots = [
  '08:00', '09:40', '10:20', '12:00',
  '14:30', '16:10', '18:00', '19:40',
  '21:20', '22:00', '23:00', '00:00'
]

export function getSlotDurationMinutes(slotKey) {
  const idx = timeSlots.indexOf(slotKey)
  if (idx === -1) return 0
  const s1 = timeSlots[idx]
  let s2 = timeSlots[(idx + 1) % timeSlots.length]
  if (s1 === '00:00') s2 = '08:00'
  
  const [h1, m1] = s1.split(':').map(Number)
  const [h2, m2] = s2.split(':').map(Number)
  let start = (h1 || 0) * 60 + (m1 || 0)
  let end = (h2 || 0) * 60 + (m2 || 0)
  if (end <= start) end += 24 * 60
  return Math.max(0, end - start)
}
