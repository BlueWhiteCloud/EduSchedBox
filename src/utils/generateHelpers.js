export function buildGeneratePayload({ weekStart, currentDate, tasks = [], constraints = {}, sendOnlyUnfinished = true, lockedSlots = [] } = {}) {
  const taskList = sendOnlyUnfinished ? tasks.filter(t => t.status !== 'completed') : Array.from(tasks)
  return {
    weekStart,
    currentDate,
    tasks: taskList,
    constraints,
    lockedSlots
  }
}

export function validateGeneratedResult(result) {
  if (!result || typeof result !== 'object') return false
  if (!result.weekStart || typeof result.weekStart !== 'string') return false
  if (!Array.isArray(result.days)) return false
  for (const d of result.days) {
    if (!d.date || typeof d.date !== 'string') return false
    if (typeof d.weekday !== 'number' || d.weekday < 1 || d.weekday > 7) return false
    if (!Array.isArray(d.slots)) return false
    for (const s of d.slots) {
      if (!s.time || typeof s.time !== 'string') return false
    }
  }
  // taskSummary and conflicts should be arrays (may be empty)
  if (!Array.isArray(result.taskSummary)) return false
  if (!Array.isArray(result.conflicts)) return false
  return true
}

export default { buildGeneratePayload, validateGeneratedResult }
