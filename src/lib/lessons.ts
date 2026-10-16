// Short daily lessons. General education about eating habits, not medical advice.

export type Lesson = { id: string; title: string; topic: string; body: string[]; tryToday: string };

export const LESSONS: Lesson[] = [
  {
    id: 'why-log',
    title: 'Why log at all?',
    topic: 'Getting started',
    body: [
      'Most people underestimate how much they eat, often by a lot. That isn’t a willpower problem; it’s how memory works. Snacks, drinks and tastes while cooking simply don’t stick.',
      'Logging turns guesses into information. You aren’t aiming for perfect numbers. A rough log you keep up beats a precise one you abandon after three days.',
      'Treat it like a mirror, not a judge. The point is to notice patterns, like the 4 pm biscuit run or the second helping when you’re tired. Then you can decide what, if anything, to change.',
    ],
    tryToday: 'Log everything today, even the small stuff. Don’t change what you eat, just watch.',
  },
  {
    id: 'colours',
    title: 'Green, yellow, orange',
    topic: 'Calorie density',
    body: [
      'Food Log colours each food by calorie density, meaning calories per gram. Green foods (under 1 kcal/g) like vegetables, fruit, soups and yoghurt are heavy on water and fibre, so they fill you up for few calories.',
      'Yellow foods (1–2.4 kcal/g) like lean meat, rice, pasta, eggs and bread are the middle ground. Orange foods (over 2.4 kcal/g) like nuts, cheese, oils, crisps and chocolate pack lots of calories into a small bite.',
      'No colour is “bad”. Olive oil and nuts are orange and genuinely nutritious. The colours only tell you how much room a food takes in your calorie budget, which helps you build meals that leave you satisfied.',
    ],
    tryToday: 'Add one extra green food to a meal, like a side salad, some fruit or a cup of soup, and notice how full you feel.',
  },
  {
    id: 'hand-portions',
    title: 'Portions in your hand',
    topic: 'Portion sizes',
    body: [
      'You don’t need scales to eyeball a portion. Your hand is always with you, and it scales with your body.',
      'A palm (thickness and size) is about one serving of protein, like meat, fish or tofu. A clenched fist is about a cup, a good guide for rice, pasta or cereal. A cupped hand is a handful of snacks or nuts. Your thumb is about a tablespoon, handy for oils, butter and peanut butter.',
      'These are estimates, not rules. They make it easier to tell Food Log what you ate, and to spot when a bowl of pasta is really three fists, not one.',
    ],
    tryToday: 'At one meal, compare your portions with your hand before eating. Adjust the portion in Food Log to match.',
  },
  {
    id: 'hunger-scale',
    title: 'The hunger scale',
    topic: 'Hunger & fullness',
    body: [
      'Picture hunger on a scale from 1 (starving, shaky) to 10 (stuffed, uncomfortable). 5 is neutral: not hungry, not full.',
      'A comfortable rhythm is to start eating around 3–4 (clearly hungry, not desperate) and stop around 6–7 (satisfied, could walk briskly). Waiting until you’re at 1 or 2 makes it much harder to choose well or stop on time.',
      'There are no wrong answers. You’re just practising noticing a signal that busy days drown out.',
    ],
    tryToday: 'Before each meal today, give your hunger a number. Do it again halfway through.',
  },
  {
    id: 'cravings',
    title: 'Riding out a craving',
    topic: 'Cravings',
    body: [
      'A craving feels urgent, but it behaves like a wave: it builds, peaks and fades, often within 10–20 minutes, whether or not you act on it.',
      '“Urge surfing” means watching the wave instead of fighting it. Notice where you feel it, rate how strong it is, and wait. Drink some water, step outside, or do a small task. Then check again.',
      'If you still want it, have it, and enjoy it on purpose: a planned portion on a plate, sitting down. Cravings lose power when they aren’t forbidden.',
    ],
    tryToday: 'Next time a craving hits, set a 10-minute timer before deciding. Note what happened.',
  },
  {
    id: 'halt',
    title: 'HALT before you snack',
    topic: 'Emotional eating',
    body: [
      'Food is comforting, and using it for comfort sometimes is normal. It becomes a problem when it’s the only tool you have.',
      'Before an unplanned snack, try the HALT check: am I Hungry, Angry (or stressed), Lonely, or Tired? Only the first one is fixed by food.',
      'If it’s one of the others, try a different tool for a few minutes: a walk, a message to a friend, a shower, a 10-minute nap or an early night. Sometimes you’ll still want the snack, and that’s fine. You’ve still made it a choice instead of a reflex.',
    ],
    tryToday: 'Run the HALT check once today when you reach for food between meals.',
  },
  {
    id: 'slow-down',
    title: 'Slow down',
    topic: 'Mindful eating',
    body: [
      'Fullness signals from your stomach and gut hormones can take around 20 minutes to register. Eat fast, and you can finish a large plate before your body has reported back.',
      'Simple ways to slow down: put your fork down between bites, sit at a table, eat without a screen for at least part of the meal, and start with something you have to chew, like salad or vegetables.',
      'Slower eating also makes food more enjoyable. You actually taste it.',
    ],
    tryToday: 'Make one meal last at least 15 minutes. Check your hunger number at the end.',
  },
  {
    id: 'protein',
    title: 'Protein keeps you full',
    topic: 'Nutrition',
    body: [
      'Of the three macronutrients, protein tends to be the most filling per calorie. It also helps preserve muscle when you’re eating less.',
      'An easy approach is to include a palm-sized protein at each meal, like eggs, Greek yoghurt, fish, chicken, beans, lentils or tofu, and build the rest of the plate around it.',
      'Your protein goal is in Settings. Watch the protein bar on the Today screen. If breakfast is mostly toast or cereal, that’s often the easiest place to add some.',
    ],
    tryToday: 'Add a protein to whichever meal usually has the least.',
  },
  {
    id: 'volume',
    title: 'Eat more, weigh less?',
    topic: 'Calorie density',
    body: [
      'Because green foods are mostly water and fibre, you can eat a big, satisfying volume of them for few calories. A large bowl of vegetable soup can have fewer calories than a small handful of crisps.',
      'You don’t have to give up dense foods. Bulk them out instead: add vegetables to pasta, mix berries into a smaller bowl of granola, swap half the rice for cauliflower rice, or start dinner with a salad.',
      'Same satisfaction, more food on the plate, fewer calories.',
    ],
    tryToday: 'Bulk up one meal with vegetables or fruit and log it to see the difference.',
  },
  {
    id: 'liquid',
    title: 'Drinks count too',
    topic: 'Nutrition',
    body: [
      'Calories in drinks are easy to miss because they barely register as food. Juice, fancy coffees, smoothies, soft drinks and alcohol can add hundreds of calories a day without making you feel any fuller.',
      'You don’t need to cut them out. Log them for a few days and see what they add up to, then pick the ones that are worth it to you.',
      'Water, sparkling water, tea and black coffee are near zero. A smaller size of the drink you love is often an easy win.',
    ],
    tryToday: 'Log every drink today, including milk in tea and coffee.',
  },
  {
    id: 'if-then',
    title: 'If-then plans',
    topic: 'Planning',
    body: [
      'Good intentions tend to fall apart at the moment of temptation. If-then plans decide in advance, when you’re calm.',
      'They look like: “If I get home starving, then I’ll have a yoghurt before I start cooking.” Or: “If there are biscuits at the meeting, then I’ll have one and bring my tea back to my desk.”',
      'Research on these “implementation intentions” shows they make follow-through noticeably more likely. Pick your two most predictable tricky moments and write a plan for each.',
    ],
    tryToday: 'Write one if-then plan for your trickiest time of day.',
  },
  {
    id: 'all-or-nothing',
    title: 'One meal doesn’t ruin a day',
    topic: 'Mindset',
    body: [
      '“I’ve blown it, so I might as well keep going” is one of the most expensive thoughts in eating. A big lunch is just a big lunch. It only becomes a big week if you give up.',
      'Progress comes from the average, not from perfect days. Ten mostly-good days with a couple of messy ones beat three perfect days followed by a week off.',
      'After a bigger meal than planned, just log it honestly and make the next meal a normal one. No compensating, no punishment.',
    ],
    tryToday: 'If something doesn’t go to plan today, log it and move straight on to the next normal meal.',
  },
  {
    id: 'sleep',
    title: 'Sleep and appetite',
    topic: 'Lifestyle',
    body: [
      'Short sleep tends to raise appetite, especially for sweet and high-calorie food, and lowers the energy and patience you need for good choices.',
      'If you notice that tired days are snacky days, that isn’t a character flaw. It’s biology. Protecting sleep can be one of the most effective eating strategies you have.',
      'A consistent bedtime, a dark, cool room and screens off a little earlier all help.',
    ],
    tryToday: 'Aim to be in bed 30 minutes earlier tonight.',
  },
  {
    id: 'environment',
    title: 'Design your kitchen',
    topic: 'Environment',
    body: [
      'We eat what we see. Willpower is limited, but you can arrange your surroundings once and let them work for you every day.',
      'Put fruit and ready-to-eat vegetables at eye level. Move the biscuits to a high cupboard or an opaque box. Serve meals from the stove instead of putting serving dishes on the table. Portion snacks into a bowl instead of eating from the packet.',
      'None of these forbid anything. They just add a little friction to the foods you want less of.',
    ],
    tryToday: 'Make one change to your kitchen so the easiest snack is a green one.',
  },
  {
    id: 'eating-out',
    title: 'Eating out',
    topic: 'Social eating',
    body: [
      'Restaurant meals are often larger and richer than home cooking, but they’re also part of enjoying life. The aim is to enjoy them without losing the whole day.',
      'Helpful moves: look at the menu ahead of time, start with a salad or broth-based soup, ask for sauces on the side, share a dessert, and stop at satisfied. You can take the rest home.',
      'To log it, snap a photo of the plate. Claude will estimate it, and you can adjust the portions before saving.',
    ],
    tryToday: 'Next time you eat out, decide on one move in advance.',
  },
  {
    id: 'weekends',
    title: 'The weekend effect',
    topic: 'Planning',
    body: [
      'Many people eat well Monday to Friday, then loosen up from Friday night to Sunday. Two and a half days can quietly undo the week.',
      'Weekends don’t need to be strict, just planned. Pick the meal or treat you’re looking forward to most and enjoy it fully. Keep the rest of the weekend’s meals fairly normal.',
      'Check the History tab: are your weekend bars taller? That’s useful information, not a verdict.',
    ],
    tryToday: 'Look at the last two weeks in History and compare weekdays with weekends.',
  },
  {
    id: 'habits',
    title: 'Motivation fades, habits stay',
    topic: 'Motivation',
    body: [
      'Motivation is great for starting and unreliable for continuing. Habits run on autopilot, so they keep going when motivation is low.',
      'Habit stacking attaches a new behaviour to an existing one: “After I pour my morning coffee, I’ll log breakfast.” “After I brush my teeth at night, I’ll check today’s totals.”',
      'Start tiny. A two-second habit you actually do beats an ambitious one you skip.',
    ],
    tryToday: 'Pick one existing routine and stack logging onto it.',
  },
  {
    id: 'self-compassion',
    title: 'Be on your own side',
    topic: 'Mindset',
    body: [
      'Harsh self-talk feels motivating but usually backfires. It brings shame, and shame often leads to more emotional eating.',
      'Self-compassion isn’t letting yourself off the hook. It means talking to yourself the way you’d talk to a friend: “That was a tough day. What would help tomorrow?”',
      'People who respond to slips with kindness tend to get back on track faster.',
    ],
    tryToday: 'Notice one critical thought about food or your body, and rewrite it the way a good friend would say it.',
  },
  {
    id: 'scale',
    title: 'Why the scale jumps around',
    topic: 'Progress',
    body: [
      'Body weight can swing by a kilo or more from one day to the next, mostly from water. Salty meals, carbs, hormones, exercise and digestion all shift it.',
      'That’s why a single weigh-in tells you very little. Look at the trend over two to four weeks instead; the weight chart on the Progress tab shows it.',
      'If you weigh yourself, do it at the same time of day under the same conditions, ideally first thing in the morning.',
    ],
    tryToday: 'If you track weight, log it in Progress, then ignore it until next week.',
  },
  {
    id: 'move-more',
    title: 'The power of everyday movement',
    topic: 'Activity',
    body: [
      'Workouts are great, but for most people the bigger lever is everyday movement: walking, standing, taking the stairs and doing chores. Together it can add up to hundreds of calories a day.',
      'Walking after meals is a particularly easy habit. Even 10 minutes helps digestion and blood sugar, and it lifts your mood.',
      'Log steps and workouts in Food Log to see your activity alongside your food. Setting a step goal you can actually hit keeps it fun.',
    ],
    tryToday: 'Take a 10-minute walk after one meal and log it.',
  },
  {
    id: 'maintenance',
    title: 'Keeping it off',
    topic: 'Maintenance',
    body: [
      'Reaching a goal is a milestone, not a finish line. People who maintain well tend to keep some of the habits that got them there: regular check-ins, plenty of filling foods, an active routine and a plan for tricky moments.',
      'Maintenance usually means a slightly higher calorie goal, not going back to old patterns. Raise your goal gradually and watch the weight trend for a few weeks.',
      'You’ve built skills: noticing hunger, riding out cravings, planning ahead, bouncing back from slips. Those don’t expire.',
    ],
    tryToday: 'Write down the three habits that have helped you most, so you can return to them anytime.',
  },
];

/** The first lesson you haven't read yet, or null when you've read them all. */
export function nextLesson(read: Map<string, string>) {
  return LESSONS.find((l) => !read.has(l.id)) ?? null;
}
