interface WithId {
  id: string;
}

interface WithDefaultFlag {
  is_default: boolean;
}

export function mergeById<T extends WithId>(
  existingItems: readonly T[],
  incomingItems: readonly T[],
): T[] {
  if (incomingItems.length === 0) {
    return [...existingItems];
  }

  const next = [...existingItems];

  for (const incomingItem of incomingItems) {
    const index = next.findIndex((item) => item.id === incomingItem.id);
    if (index === -1) {
      next.push(incomingItem);
      continue;
    }

    next[index] = incomingItem;
  }

  return next;
}

export function findDefaultItem<T extends WithDefaultFlag>(items: readonly T[]) {
  return items.find((item) => item.is_default);
}
