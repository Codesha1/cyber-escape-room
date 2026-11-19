import 'server-only';
import { err } from './game';

export async function readBody(req: Request): Promise<Record<string, any>> {
  try {
    const b = await req.json();
    return b && typeof b === 'object' ? b : {};
  } catch {
    return {};
  }
}

// يلتقط أي خطأ غير متوقع ويعيد رسالة عربية واضحة دون كشف التفاصيل
export function safe<A extends any[]>(fn: (...a: A) => Promise<Response>) {
  return async (...a: A): Promise<Response> => {
    try {
      return await fn(...a);
    } catch (e) {
      console.error('[api]', e);
      return err('حدث خطأ في الخادم، حاولي مرة أخرى بعد لحظات.', 500);
    }
  };
}
