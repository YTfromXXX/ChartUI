'use client';

import KnotChartWorkspace from '@/components/KnotChartWorkspace';
import { FIELD_CONFIGS } from '@/lib/fieldModels';

export default function CryptoCrashPage() {
  return <KnotChartWorkspace field={FIELD_CONFIGS.crypto} />;
}
