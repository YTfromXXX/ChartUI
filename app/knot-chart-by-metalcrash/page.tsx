'use client';

import KnotChartWorkspace from '@/components/KnotChartWorkspace';
import { FIELD_CONFIGS } from '@/lib/fieldModels';

export default function MetalCrashPage() {
  return <KnotChartWorkspace field={FIELD_CONFIGS.metal} />;
}
