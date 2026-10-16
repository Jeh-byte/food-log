import { addDays, daysBetween, today } from './dates';

/** Current run of consecutive logged days, counting today or (if today isn't logged yet) yesterday. */
export function currentStreak(datesDesc: string[]) {
  const set = new Set(datesDesc);
  const t = today();
  let day = set.has(t) ? t : addDays(t, -1);
  let n = 0;
  while (set.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function bestStreak(datesDesc: string[]) {
  const asc = [...datesDesc].sort();
  let best = 0;
  let run = 0;
  for (let i = 0; i < asc.length; i++) {
    run = i > 0 && daysBetween(asc[i - 1], asc[i]) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

export type BadgeInput = {
  loggedDays: number;
  bestStreak: number;
  lessonsRead: number;
  totalLessons: number;
  workouts: number;
  maxSteps: number;
  weighIns: number;
  favorites: number;
};

export type Badge = { id: string; icon: string; title: string; detail: string; earned: boolean };

export function badges(x: BadgeInput): Badge[] {
  return [
    { id: 'first', icon: '🍽️', title: 'First bite', detail: 'Log your first meal', earned: x.loggedDays >= 1 },
    { id: 'streak3', icon: '🔥', title: 'On a roll', detail: 'Log 3 days in a row', earned: x.bestStreak >= 3 },
    { id: 'streak7', icon: '📅', title: 'Full week', detail: 'Log 7 days in a row', earned: x.bestStreak >= 7 },
    { id: 'streak30', icon: '🏆', title: 'Habit formed', detail: 'Log 30 days in a row', earned: x.bestStreak >= 30 },
    { id: 'days100', icon: '💯', title: 'Century', detail: 'Log 100 days in total', earned: x.loggedDays >= 100 },
    { id: 'fav', icon: '⭐', title: 'Regular', detail: 'Save a favorite meal', earned: x.favorites >= 1 },
    { id: 'lesson1', icon: '📖', title: 'Curious', detail: 'Read your first lesson', earned: x.lessonsRead >= 1 },
    { id: 'lesson7', icon: '🧠', title: 'Week of learning', detail: 'Read 7 lessons', earned: x.lessonsRead >= 7 },
    {
      id: 'lessonsAll', icon: '🎓', title: 'Graduate', detail: 'Read every lesson',
      earned: x.totalLessons > 0 && x.lessonsRead >= x.totalLessons,
    },
    { id: 'steps10k', icon: '👟', title: '10k day', detail: 'Log 10,000 steps in a day', earned: x.maxSteps >= 10000 },
    { id: 'workout5', icon: '💪', title: 'Moving', detail: 'Log 5 workouts', earned: x.workouts >= 5 },
    { id: 'weigh', icon: '⚖️', title: 'Checked in', detail: 'Log your weight', earned: x.weighIns >= 1 },
  ];
}
