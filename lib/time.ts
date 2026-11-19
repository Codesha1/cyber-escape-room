// يضيف زمن اللعب الفعلي فقط: الفجوة بين نبضتين متتاليتين لا تُحتسب إذا تجاوزت 20 ثانية
// (أي أن وقت إغلاق الصفحة أو خروجها منها لا يُحسب على المشاركة)
export const ACCUMULATE_SQL = `active_ms + CASE
  WHEN last_beat IS NOT NULL AND now() - last_beat <= interval '20 seconds'
  THEN GREATEST(0, (extract(epoch FROM (now() - last_beat)) * 1000)::bigint)
  ELSE 0 END`;
