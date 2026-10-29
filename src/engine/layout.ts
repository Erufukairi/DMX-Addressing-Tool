import { MAX_ADDRESS, type Layout, type LayoutResult, type PlacedFixture } from './types';
import { hasErrors, validateLayout } from './validate';

/** Pure and deterministic. Throws if the layout fails validation; call validateLayout first. */
export function computeLayout(layout: Layout): LayoutResult {
  const errors = validateLayout(layout);
  if (hasErrors(errors)) {
    throw new Error(`Invalid layout: ${Object.values(errors).join('; ')}`);
  }
  // validateLayout guarantees simple mode with simple settings present.
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
  const next = start + count * footprint;
  const nextAddress = next > MAX_ADDRESS ? null : next;

  return {
    placed,
    notPlaced: shortfall > 0 ? [{ count: shortfall }] : [],
    nextAddress,
    remaining: nextAddress === null ? 0 : MAX_ADDRESS - nextAddress + 1,
  };
}
