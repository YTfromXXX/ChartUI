import { NextResponse } from 'next/server';
import { createFieldSimulator } from '@/lib/fieldModels';
import { fetchMetalPrice, MetalFeedError } from '@/lib/api/metalFetcher';

export const dynamic = 'force-dynamic';

const syntheticMetal = createFieldSimulator('metal', 20261021);

function syntheticFallback(reason: string) {
  const step = syntheticMetal(Date.now());
  return NextResponse.json({
    price: step.diagnostics?.xauUsdPrice ?? 2650,
    timestamp: Date.now(),
    provider: 'field-model',
    source: 'SYNTHETIC',
    fallbackReason: reason,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET() {
  try {
    const quote = await fetchMetalPrice();
    return NextResponse.json(quote, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const reason = error instanceof MetalFeedError ? error.code : 'upstream_error';
    console.warn(`[metal-feed] serving synthetic quote (${reason})`);
    return syntheticFallback(reason);
  }
}
