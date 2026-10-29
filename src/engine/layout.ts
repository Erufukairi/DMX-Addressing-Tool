import {
  MAX_ADDRESS,
  isPattern,
  type Block,
  type Layout,
  type LayoutResult,
  type PlacedFixture,
} from './types';
import { hasErrors, validateLayout } from './validate';

/** Pure and deterministic. Throws if the layout fails validation; call validateLayout first. */
export function computeLayout(layout: Layout): LayoutResult {
  const errors = validateLayout(layout);
  if (hasErrors(errors)) {
    throw new Error(`Invalid layout: ${JSON.stringify(errors)}`);
  }
  return layout.mode === 'advanced' ? computeAdvanced(layout) : computeSimple(layout);
}

function finish(placed: PlacedFixture[], next: number, notPlaced: LayoutResult['notPlaced']): LayoutResult {
  const nextAddress = next > MAX_ADDRESS ? null : next;
  return {
    placed,
    notPlaced,
    nextAddress,
    remaining: nextAddress === null ? 0 : MAX_ADDRESS - nextAddress + 1,
  };
}

function computeSimple(layout: Layout): LayoutResult {
  // validateLayout guarantees simple settings are present.
  const { footprint, quantity } = layout.simple!;
  const start = layout.startAddress;

  const fitCount = Math.floor((MAX_ADDRESS - start + 1) / footprint);
  const count = quantity === undefined ? fitCount : Math.min(quantity, fitCount);

  const placed: PlacedFixture[] = [];
  for (let i = 0; i < count; i++) {
    const address = start + i * footprint;
    placed.push({ unit: i + 1, address, endAddress: address + footprint - 1 });
  }

  const shortfall = quantity === undefined ? 0 : quantity - count;
  return finish(placed, start + count * footprint, shortfall > 0 ? [{ count: shortfall }] : []);
}

function labelOf(block: Block): string | undefined {
  return block.label?.trim() || undefined;
}

/**
 * Packs the sequence end to end. Placement stops at the first fixture that doesn't fit and never
 * skips ahead to a smaller one (design doc §7). Everything after that is counted per block,
 * summed across pattern repeats, in sequence order.
 */
function computeAdvanced(layout: Layout): LayoutResult {
  const placed: PlacedFixture[] = [];
  const notPlaced = new Map<string, LayoutResult['notPlaced'][number]>();
  let address = layout.startAddress;
  let stopped = false;

  const skip = (block: Block, count: number) => {
    if (count <= 0) return;
    const entry = notPlaced.get(block.id);
    if (entry) entry.count += count;
    else {
      const label = labelOf(block);
      notPlaced.set(block.id, label === undefined ? { blockId: block.id, count } : { blockId: block.id, label, count });
    }
  };

  const place = (block: Block, count: number) => {
    if (stopped) return skip(block, count);
    const fit = Math.min(count, Math.floor((MAX_ADDRESS - address + 1) / block.footprint));
    const label = labelOf(block);
    for (let i = 0; i < fit; i++) {
      const fixture: PlacedFixture = {
        unit: placed.length + 1,
        blockId: block.id,
        address,
        endAddress: address + block.footprint - 1,
      };
      if (label !== undefined) fixture.label = label;
      placed.push(fixture);
      address += block.footprint;
    }
    if (fit < count) {
      stopped = true;
      skip(block, count - fit);
    }
  };

  for (const item of layout.sequence!) {
    if (!isPattern(item)) {
      place(item, item.quantity);
      continue;
    }
    for (let r = 0; r < item.repeat; r++) {
      for (const block of item.blocks) place(block, block.quantity);
      if (stopped) {
        // Count the remaining repeats arithmetically; repeat can be large.
        const left = item.repeat - r - 1;
        for (const block of item.blocks) skip(block, left * block.quantity);
        break;
      }
    }
  }

  return finish(placed, address, [...notPlaced.values()]);
}
