#!/usr/bin/env node
/**
 * Фото порід із теки Даші → webp за слагом породи.
 *
 * Імена файлів — людські назви, і зіставлення з довідником робиться тут
 * руками, а не здогадкою за схожістю рядків: «вівчарка» це німецька, а не
 * карпатська, а «шнауцер» у нас заведений як цвергшнауцер. Автоматика тут
 * вгадувала б тихо й неправильно.
 *
 * Один файл може обслуговувати дві породи: на фото «акіта іну та шіба іну»
 * обидві собаки, і ставити його обом — чесно.
 *
 * Породи, яких у теці немає, отримують заглушку («Ця Бабака поки без фото»):
 * порожня плитка виглядала б як поломка, а заглушка — як обіцянка.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = '/home/claude/breeds-src/породи';
const OUT = '/home/claude/assets/breeds';

/** файл (без .png) → слаг або кілька слагів */
const MAP = {
  'французський бульдог': 'frantsuzkyi-buldog',
  'амстафф': 'staford',
  "джек рассел тер'єр": 'dzhek-rassel',
  'мопс': 'mops',
  'акіта іну та шіба іну': ['akita-inu', 'siba-inu'],
  'коргі': 'korgi',
  'ротвейлер': 'rotveiler',
  "вест хайленд вайт тер'єр": 'vestik',
  'доберман': 'doberman',
  'італійський хорт (левретка)': 'levretka',
  'шпіц': 'shpits',
  'пудель': 'pudel',
  'той-терʼєр': 'toi-terier',
  'бігль': 'bigl',
  'кавалер кінг чарльз спанієль': 'kavaler-charlz',
  'самоїд': 'samoyid',
  'такса': 'taksa',
  'хаскі': 'khaski',
  'шнауцер': 'tsvergshnautser',
  "йоркширський тер'єр": 'yorkshyrskyi-terier',
  "бультер'єр": 'bulteryer',
  'золотистий ретривер': 'retriver',
  'далматин': 'dalmatynets',
  'мальтіпу': 'maltipu',
  'лабрадор': 'labrador',
  'мальтезе': 'maltese',
  'чіхуахуа': 'chihuahua',
  'кане корсо': 'kane-korso',
  'ксолоітцкуінтлі': 'ksolo',
  'вівчарка': 'nimetska-vivcharka',
};

/** Породи довідника, для яких фото ще немає. */
const PLACEHOLDER = [
  'bishon-frize', 'honchak', 'karpatska-vivcharka',
  'koker-spaniel', 'shi-tsu', 'velykyi-dog',
];

/**
 * Імена файлів прийшли з macOS, а вона зберігає їх у формі NFD: «й» там не
 * один символ, а «и» плюс окрема кратка. У коді ті самі назви написані в NFC,
 * і рядки, які на око однакові, не збігаються. Тому шукаємо файл не за
 * точним іменем, а за нормалізованим.
 */
const byName = new Map(
  readdirSync(SRC)
    .filter((f) => f.endsWith('.png'))
    .map((f) => [f.slice(0, -4).normalize('NFC'), join(SRC, f)]),
);
const find = (name) => byName.get(name.normalize('NFC'));

const LIMITS = ['-limit', 'memory', '3GiB', '-limit', 'map', '6GiB'];
const convert = (src, slug) => execFileSync('convert', [
  ...LIMITS, src, '-resize', '900x900>', '-quality', '88', join(OUT, `${slug}.webp`),
]);

let done = 0; const problems = [];

for (const [file, target] of Object.entries(MAP)) {
  const src = find(file);
  if (!src) { problems.push(`немає файла: ${file}.png`); continue; }
  for (const slug of [target].flat()) { convert(src, slug); done += 1; }
}

const stub = find('заглушка');
if (!stub) problems.push('немає заглушка.png');
else for (const slug of PLACEHOLDER) { convert(stub, slug); done += 1; }

const mapped = new Set(Object.keys(MAP).map((n) => n.normalize('NFC')));
const unused = [...byName.keys()].filter((n) => n !== 'заглушка' && !mapped.has(n));

console.log(`зроблено: ${done} файлів у ${OUT}`);
console.log(`з фото: ${Object.values(MAP).flat().length}, із заглушкою: ${PLACEHOLDER.length}`);
if (unused.length) console.log(`НЕ ЗІСТАВЛЕНО (лишились без слага):\n  ${unused.join('\n  ')}`);
if (problems.length) console.log(problems.join('\n'));
