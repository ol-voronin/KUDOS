import { describe, expect, it } from 'vitest';
import { AnalyticsEventName, EVENT_LABELS, TrackEventDto } from './analytics.dto';

describe('TrackEventDto', () => {
  it('приймає події воронки товару із сумою в копійках', () => {
    for (const name of ['view_item', 'add_to_cart'] as const) {
      const parsed = TrackEventDto.parse({ name, path: '/prints/korgi', valueMinor: 129_000 });
      expect(parsed.name).toBe(name);
      expect(parsed.valueMinor).toBe(129_000);
    }
  });

  it('приймає перегляд товару без суми', () => {
    expect(TrackEventDto.parse({ name: 'view_item', path: '/prints/korgi' }).valueMinor).toBeNull();
  });

  it('відкидає назви поза закритим переліком', () => {
    expect(TrackEventDto.safeParse({ name: 'addToCart', path: '/' }).success).toBe(false);
  });
});

describe('EVENT_LABELS', () => {
  it('має підпис для кожної події', () => {
    for (const name of AnalyticsEventName.options) {
      expect(EVENT_LABELS[name]).toBeTruthy();
    }
  });
});
