/* ЗГЕНЕРОВАНО tools/print-preview.py placements. Не редагувати руками. */

import type { Placement } from './print-placement';

/** Колекція → виріб → рамка принта (з прикладу розташування). */
export const COLLECTION_PLACEMENTS: Readonly<Record<string, Readonly<Record<string, Placement>>>> = {
  'babaky-v-pabi': {
    'futbolka-klasychna': { cx: 0.4989, cy: 0.3551, w: 0.2532, h: 0.2532, rot: 0.0114 },
    'futbolka-oversayz-cholovicha': { cx: 0.5700, cy: 0.3372, w: 0.2682, h: 0.1896, rot: 14.9922 },
    'futbolka-oversayz-zhinocha': { cx: 0.5210, cy: 0.4499, w: 0.2512, h: 0.1777, rot: -0.0048 },
    'hibryd-hudi': { cx: 0.5116, cy: 0.4177, w: 0.2682, h: 0.1897, rot: 0.0178 },
    'hibryd-svitshot': { cx: 0.5433, cy: 0.3085, w: 0.2683, h: 0.1897, rot: 14.9877 },
    'hudi-klasychnyi': { cx: 0.6001, cy: 0.4610, w: 0.1898, h: 0.1342, rot: 0.0128 },
    'svitshot-klasychnyi': { cx: 0.6686, cy: 0.4567, w: 0.1897, h: 0.1342, rot: 0.0017 },
  },
  'polo-babaky': {
    'futbolka-klasychna': { cx: 0.5069, cy: 0.4029, w: 0.3045, h: 0.3560, rot: 0.0026 },
    'futbolka-oversayz-cholovicha': { cx: 0.5617, cy: 0.3726, w: 0.3226, h: 0.2666, rot: 13.7516 },
    'futbolka-oversayz-zhinocha': { cx: 0.5246, cy: 0.5018, w: 0.3226, h: 0.2666, rot: -0.0064 },
    'hibryd-hudi': { cx: 0.5121, cy: 0.4617, w: 0.3224, h: 0.2665, rot: 0.0122 },
    'hibryd-svitshot': { cx: 0.5302, cy: 0.3427, w: 0.3225, h: 0.2666, rot: 14.0003 },
    'hudi-klasychnyi': { cx: 0.6009, cy: 0.4854, w: 0.2003, h: 0.1655, rot: -0.0330 },
    'svitshot-klasychnyi': { cx: 0.6664, cy: 0.4721, w: 0.2178, h: 0.1800, rot: 0.0107 },
  },
};

/** Окремий принт → виріб → рамка. Перекриває колекцію. */
export const PRINT_PLACEMENTS: Readonly<Record<string, Readonly<Record<string, Placement>>>> = {
  'zirky-semiuel': {
    'futbolka-klasychna': { cx: 0.4992, cy: 0.4208, w: 0.2782, h: 0.4071, rot: -0.0420 },
    'futbolka-oversayz-cholovicha': { cx: 0.5534, cy: 0.3974, w: 0.2947, h: 0.3049, rot: 14.8427 },
    'futbolka-oversayz-zhinocha': { cx: 0.5247, cy: 0.5006, w: 0.2532, h: 0.2620, rot: -0.0209 },
    'hibryd-hudi': { cx: 0.4992, cy: 0.4575, w: 0.2625, h: 0.2717, rot: 0.0033 },
    'hibryd-svitshot': { cx: 0.5315, cy: 0.3621, w: 0.2947, h: 0.3050, rot: 14.1824 },
    'hudi-klasychnyi': { cx: 0.6050, cy: 0.4844, w: 0.1832, h: 0.1896, rot: 0.0066 },
    'svitshot-klasychnyi': { cx: 0.6616, cy: 0.4820, w: 0.1999, h: 0.2069, rot: -0.0645 },
  },
};
