import { json, leaderboard } from '@/lib/game';
import { safe } from '@/lib/route';

export const dynamic = 'force-dynamic';

export const GET = safe(async () => json(await leaderboard()));
