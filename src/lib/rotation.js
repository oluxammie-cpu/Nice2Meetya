/**
 * Optimised rotation algorithm for Nice2Meetya!
 *
 * Goal: across all rounds, maximise unique pairings.
 * Each guest should meet as many different people as possible.
 *
 * Approach: graph-based greedy optimisation.
 * - Track all existing pairings as a weighted graph
 * - For each round, assign guests to groups minimising repeat pairings
 * - Uses simulated annealing-style local search for large guest counts
 * - Scales to any guest count and group count
 */

/**
 * Count shared group pairings between a candidate assignment and existing history
 */
function countRepeatPairings(assignment, history) {
  let repeats = 0
  for (const group of Object.values(assignment)) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const key = [group[i], group[j]].sort().join('|')
        if (history.has(key)) repeats++
      }
    }
  }
  return repeats
}

/**
 * Add all pairings from an assignment to the history set
 */
function recordPairings(assignment, history) {
  for (const group of Object.values(assignment)) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const key = [group[i], group[j]].sort().join('|')
        history.add(key)
      }
    }
  }
}

/**
 * Generate a random assignment of guests to groups
 * Returns { groupIndex: [guestId, ...] }
 */
function randomAssignment(guestIds, numGroups) {
  const shuffled = [...guestIds].sort(() => Math.random() - 0.5)
  const groups = {}
  for (let i = 0; i < numGroups; i++) groups[i] = []
  shuffled.forEach((id, i) => groups[i % numGroups].push(id))
  return groups
}

/**
 * Try to improve an assignment by swapping two guests from different groups
 * Returns the improved assignment (or original if no improvement found)
 */
function localSearch(assignment, history, iterations = 500) {
  let best = assignment
  let bestScore = countRepeatPairings(assignment, history)

  const groupKeys = Object.keys(best).map(Number)

  for (let iter = 0; iter < iterations; iter++) {
    // Pick two different random groups
    const g1 = groupKeys[Math.floor(Math.random() * groupKeys.length)]
    let g2 = groupKeys[Math.floor(Math.random() * groupKeys.length)]
    while (g2 === g1 && groupKeys.length > 1) {
      g2 = groupKeys[Math.floor(Math.random() * groupKeys.length)]
    }
    if (g2 === g1) continue

    if (!best[g1].length || !best[g2].length) continue

    // Pick a random guest from each group
    const i1 = Math.floor(Math.random() * best[g1].length)
    const i2 = Math.floor(Math.random() * best[g2].length)

    // Swap
    const candidate = {}
    for (const k of groupKeys) candidate[k] = [...best[k]]
    const tmp = candidate[g1][i1]
    candidate[g1][i1] = candidate[g2][i2]
    candidate[g2][i2] = tmp

    const score = countRepeatPairings(candidate, history)
    if (score < bestScore) {
      best = candidate
      bestScore = score
    }

    // Early exit if perfect
    if (bestScore === 0) break
  }

  return best
}

/**
 * Main export: generate optimised assignments for all rounds
 *
 * @param {string[]} guestIds - array of guest IDs
 * @param {number} numGroups - number of groups
 * @param {number} numRounds - number of rounds (default 3)
 * @param {number} attempts - random restarts to find best solution (default 20)
 * @returns {Array<Object>} - array of round assignments: [{ groupIndex: [guestId] }]
 */
export function optimiseRotations(guestIds, numGroups, numRounds = 3, attempts = 20) {
  if (guestIds.length === 0 || numGroups === 0) return []

  const rounds = []
  const history = new Set()

  for (let round = 0; round < numRounds; round++) {
    let bestAssignment = null
    let bestScore = Infinity

    // Multiple random restarts — take the best
    for (let attempt = 0; attempt < attempts; attempt++) {
      const initial = randomAssignment(guestIds, numGroups)
      const optimised = localSearch(initial, history, 800)
      const score = countRepeatPairings(optimised, history)

      if (score < bestScore) {
        bestScore = score
        bestAssignment = optimised
      }

      if (bestScore === 0) break
    }

    rounds.push(bestAssignment)
    recordPairings(bestAssignment, history)
  }

  return rounds
}

/**
 * Convert optimised rounds to per-guest table assignments
 * Returns { guestId: { round1_table, round2_table, round3_table } }
 */
export function roundsToAssignments(rounds) {
  const result = {}

  rounds.forEach((round, ri) => {
    for (const [groupIndex, guestIds] of Object.entries(round)) {
      for (const guestId of guestIds) {
        if (!result[guestId]) result[guestId] = {}
        result[guestId][`round${ri + 1}_table`] = parseInt(groupIndex) + 1
      }
    }
  })

  return result
}

/**
 * Calculate coverage stats for a set of rounds
 * Returns { totalPossiblePairs, uniquePairsMet, coveragePercent, repeatPairs }
 */
export function calculateCoverage(guestIds, rounds) {
  const n = guestIds.length
  const totalPossible = (n * (n - 1)) / 2
  const metPairs = new Set()
  let repeatPairs = 0

  for (const round of rounds) {
    for (const group of Object.values(round)) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const key = [group[i], group[j]].sort().join('|')
          if (metPairs.has(key)) repeatPairs++
          metPairs.add(key)
        }
      }
    }
  }

  return {
    totalPossiblePairs: totalPossible,
    uniquePairsMet: metPairs.size,
    coveragePercent: Math.round((metPairs.size / totalPossible) * 100),
    repeatPairs,
  }
}
