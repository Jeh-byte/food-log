// Calories burned estimates. Workouts use MET values from the Compendium of Physical Activities;
// we count only the calories above resting (MET − 1), since resting burn is already in your goal.

export const WORKOUTS: { name: string; met: number }[] = [
  { name: 'Walking (brisk)', met: 4.3 },
  { name: 'Running', met: 9.8 },
  { name: 'Cycling', met: 7.5 },
  { name: 'Swimming', met: 6.0 },
  { name: 'Strength training', met: 5.0 },
  { name: 'HIIT', met: 8.0 },
  { name: 'Hiking', met: 6.0 },
  { name: 'Dancing', met: 5.0 },
  { name: 'Yoga', met: 2.5 },
  { name: 'Stretching', met: 2.3 },
  { name: 'Gardening', met: 3.5 },
  { name: 'Other (moderate)', met: 4.0 },
];

export function workoutCalories(name: string, minutes: number, weightKg: number) {
  const met = WORKOUTS.find((w) => w.name === name)?.met ?? 4;
  return Math.max(0, (met - 1) * weightKg * (minutes / 60));
}

/** Roughly 0.04 kcal per step for a 70 kg person, scaled by body weight. */
export const stepCalories = (steps: number, weightKg: number) => steps * 0.04 * (weightKg / 70);

export const KG_PER_LB = 0.45359237;
export const toDisplayWeight = (kg: number, units: 'kg' | 'lb') => (units === 'kg' ? kg : kg / KG_PER_LB);
export const fromDisplayWeight = (v: number, units: 'kg' | 'lb') => (units === 'kg' ? v : v * KG_PER_LB);
