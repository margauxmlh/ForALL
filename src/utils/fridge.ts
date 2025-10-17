import type { FridgeItem } from '../services/fridgeService';

export type GroupedFridgeItems = {
  urgent: FridgeItem[];
  thisWeek: FridgeItem[];
  later: FridgeItem[];
  noDate: FridgeItem[];
};

const startOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const parseDate = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const sortItemsByExpiry = (items: FridgeItem[]): FridgeItem[] => {
  return [...items].sort((a, b) => {
    const dateA = parseDate(a.expiryDate);
    const dateB = parseDate(b.expiryDate);

    if (!dateA && !dateB) {
      return a.name.localeCompare(b.name);
    }
    if (!dateA) return 1;
    if (!dateB) return -1;

    const diff = dateA.getTime() - dateB.getTime();
    if (diff !== 0) {
      return diff;
    }

    return a.name.localeCompare(b.name);
  });
};

export const groupItemsByExpiry = (
  items: FridgeItem[],
  reference: Date = new Date()
): GroupedFridgeItems => {
  const base = startOfDay(reference);
  const groups: GroupedFridgeItems = {
    urgent: [],
    thisWeek: [],
    later: [],
    noDate: [],
  };

  for (const item of items) {
    const expiryDate = parseDate(item.expiryDate);
    if (!expiryDate) {
      groups.noDate.push(item);
      continue;
    }

    const normalizedExpiry = startOfDay(expiryDate);
    const diffInMs = normalizedExpiry.getTime() - base.getTime();
    const diffInDays = Math.ceil(diffInMs / (24 * 60 * 60 * 1000));

    if (diffInDays <= 3) {
      groups.urgent.push(item);
    } else if (diffInDays <= 7) {
      groups.thisWeek.push(item);
    } else {
      groups.later.push(item);
    }
  }

  return {
    urgent: sortItemsByExpiry(groups.urgent),
    thisWeek: sortItemsByExpiry(groups.thisWeek),
    later: sortItemsByExpiry(groups.later),
    noDate: sortItemsByExpiry(groups.noDate),
  };
};
