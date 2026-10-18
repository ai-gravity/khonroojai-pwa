const GROUPS = {
  'white-female': {
    label: 'White women',
    lnAge: -29.799, lnAgeSquared: 4.884, lnTC: 13.540, lnAgeLnTC: -3.114, lnHDL: -13.578, lnAgeLnHDL: 3.149,
    lnTreatedSBP: 2.019, lnUntreatedSBP: 1.957, lnAgeLnTreatedSBP: null, lnAgeLnUntreatedSBP: null,
    smoker: 7.574, lnAgeSmoker: -1.665, diabetes: 0.661, mean: -29.18, survival: 0.9665
  },
  'african-american-female': {
    label: 'African-American women',
    lnAge: 17.114, lnAgeSquared: null, lnTC: 0.940, lnAgeLnTC: null, lnHDL: -18.920, lnAgeLnHDL: 4.475,
    lnTreatedSBP: 29.291, lnUntreatedSBP: 27.820, lnAgeLnTreatedSBP: -6.432, lnAgeLnUntreatedSBP: -6.087,
    smoker: 0.691, lnAgeSmoker: null, diabetes: 0.874, mean: 86.61, survival: 0.9533
  },
  'white-male': {
    label: 'White men',
    lnAge: 12.344, lnAgeSquared: null, lnTC: 11.853, lnAgeLnTC: -2.664, lnHDL: -7.990, lnAgeLnHDL: 1.769,
    lnTreatedSBP: 1.797, lnUntreatedSBP: 1.764, lnAgeLnTreatedSBP: null, lnAgeLnUntreatedSBP: null,
    smoker: 7.837, lnAgeSmoker: -1.795, diabetes: 0.658, mean: 61.18, survival: 0.9144
  },
  'african-american-male': {
    label: 'African-American men',
    lnAge: 2.469, lnAgeSquared: null, lnTC: 0.302, lnAgeLnTC: null, lnHDL: -0.307, lnAgeLnHDL: null,
    lnTreatedSBP: 1.916, lnUntreatedSBP: 1.809, lnAgeLnTreatedSBP: null, lnAgeLnUntreatedSBP: null,
    smoker: 0.549, lnAgeSmoker: null, diabetes: 0.645, mean: 19.54, survival: 0.8954
  }
}

function finite(value) {
  return Number.isFinite(Number(value))
}

export function calculateLegacyPCE(input = {}) {
  const age = Number(input.age)
  const totalCholesterol = Number(input.totalCholesterol)
  const hdl = Number(input.hdl)
  const systolic = Number(input.systolic)
  const sex = String(input.sex || '')
  const population = String(input.population || '')
  const treated = input.treated === true || input.treated === 'yes'
  const smoker = input.smoker === true || input.smoker === 'yes'
  const diabetes = input.diabetes === true || input.diabetes === 'yes'
  const priorASCVD = input.priorASCVD === true || input.priorASCVD === 'yes'
  const key = `${population}-${sex}`
  const group = GROUPS[key]
  const missing = [age, totalCholesterol, hdl, systolic].some((value) => !finite(value)) || !group || typeof input.treated === 'undefined' || typeof input.smoker === 'undefined' || typeof input.diabetes === 'undefined' || typeof input.priorASCVD === 'undefined'

  if (missing) return { valid: false, reason: 'incomplete-inputs' }
  if (priorASCVD) return { valid: false, reason: 'prior-ascvd' }
  if (age < 40 || age > 79 || totalCholesterol < 130 || totalCholesterol > 320 || hdl < 20 || hdl > 100 || systolic < 90 || systolic > 200) return { valid: false, reason: 'out-of-range' }

  const lnAge = Math.log(age); const lnTC = Math.log(totalCholesterol); const lnHDL = Math.log(hdl); const lnSBP = Math.log(systolic)
  let sum = group.lnAge * lnAge
  if (group.lnAgeSquared !== null) sum += group.lnAgeSquared * lnAge ** 2
  sum += group.lnTC * lnTC
  if (group.lnAgeLnTC !== null) sum += group.lnAgeLnTC * lnAge * lnTC
  sum += group.lnHDL * lnHDL
  if (group.lnAgeLnHDL !== null) sum += group.lnAgeLnHDL * lnAge * lnHDL
  sum += (treated ? group.lnTreatedSBP : group.lnUntreatedSBP) * lnSBP
  const ageSbpCoefficient = treated ? group.lnAgeLnTreatedSBP : group.lnAgeLnUntreatedSBP
  if (ageSbpCoefficient !== null) sum += ageSbpCoefficient * lnAge * lnSBP
  sum += group.smoker * (smoker ? 1 : 0)
  if (group.lnAgeSmoker !== null) sum += group.lnAgeSmoker * lnAge * (smoker ? 1 : 0)
  sum += group.diabetes * (diabetes ? 1 : 0)
  const risk = 100 * (1 - group.survival ** Math.exp(sum - group.mean))
  return { valid: true, riskPercent: Math.max(0, Math.min(100, risk)), group: group.label, population, sex, linearPredictor: sum }
}

export const legacyPCEGroups = Object.freeze(Object.keys(GROUPS))
