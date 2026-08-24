import { describe, expect, it } from 'vitest';
import { formatBrief } from './format-brief';

const base = {
  number: 7,
  customerName: 'Оля',
  customerPhone: '+380671234567',
  dogName: 'Барні',
  dogBreed: 'Коргі',
  garmentType: 'HOODIE',
  mood: 'Портрет у стилі ренесанс',
  photoCount: 0,
  customerSuppliedArtwork: false,
};

describe('formatBrief', () => {
  it('містить усе, без чого не можна передзвонити', () => {
    const text = formatBrief(base);
    expect(text).toContain('№7');
    expect(text).toContain('Оля');
    expect(text).toContain('+380671234567');
    expect(text).toContain('Барні');
    expect(text).toContain('Коргі');
    expect(text).toContain('худі');
  });

  it('екранує HTML — інакше «Аня <3» ламає повідомлення', () => {
    const text = formatBrief({ ...base, customerName: 'Аня <3', mood: 'щось & щось' });
    expect(text).toContain('Аня &lt;3');
    expect(text).toContain('щось &amp; щось');
    expect(text).not.toContain('<3');
  });

  it('без фото каже, що робити, а не просто «0»', () => {
    expect(formatBrief(base)).toContain('попросіть у відповідь');
    expect(formatBrief({ ...base, photoCount: 3 })).toContain('Фото: 3');
  });

  it('розрізняє свій макет і роботу з нуля — це різні гроші', () => {
    expect(formatBrief({ ...base, customerSuppliedArtwork: true })).toContain('150 ₴');
    expect(formatBrief(base)).toContain('з нуля');
  });
});
