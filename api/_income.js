// Income shown to users is capped by the hours they told us they have. Stored plans
// reached €72,000 a month, so the model's own numbers cannot be trusted as a limit.
const CEILING_HOURLY_EUR = 40;
const WEEKS_PER_MONTH = 4.3;

export function hoursPerWeek(time) {
  const text = String(time || '');
  if (/full/i.test(text)) return 40;
  const numbers = (text.match(/\d+/g) || []).map(Number);
  if (!numbers.length) return 10;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

export function monthlyCeiling(time) {
  return Math.round(hoursPerWeek(time) * WEEKS_PER_MONTH * CEILING_HOURLY_EUR / 50) * 50;
}

export function incomeRule(time) {
  return `This person has ${time} a week. No monthly income figure may exceed €${monthlyCeiling(time)}, which is about €${CEILING_HOURLY_EUR} an hour for all their hours. A beginner earns less at first, so the early months should be far lower. Do not put income amounts in any other text.`;
}

function ceilingNote(time) {
  return `Upper limit based on your ${hoursPerWeek(time)} hours a week at about €${CEILING_HOURLY_EUR} an hour. Treat it as a ceiling, not a promise. Many people earn less, especially at first.`;
}

const scaled = (value, factor) => Math.round((Number(value) || 0) * factor / 10) * 10;

// Keeps the shape of the curve by scaling every month, so low and high stay in order
function scaleFields(target, fields, factor) {
  for (const field of fields) {
    if (target[field] != null) target[field] = scaled(target[field], factor);
  }
}

export function capForecast(forecast, time) {
  const top = Number(forecast?.month_12_high) || 0;
  const ceiling = monthlyCeiling(time);
  if (top <= ceiling) return forecast;
  scaleFields(forecast, ['month_3_low', 'month_3_high', 'month_6_low', 'month_6_high', 'month_12_low', 'month_12_high'], ceiling / top);
  forecast.month_12_math = ceilingNote(time);
  forecast.explanation = ceilingNote(time);
  return forecast;
}

export function capProjection(projection, time) {
  const top = Number(projection?.month_12) || 0;
  const ceiling = monthlyCeiling(time);
  if (top <= ceiling) return projection;
  const factor = ceiling / top;
  scaleFields(projection, ['month_1', 'month_2', 'month_3', 'month_6', 'month_9', 'month_12', 'year_2_potential'], factor);
  for (const source of projection.income_sources || []) scaleFields(source, ['monthly_amount'], factor);
  projection.month_12_math = ceilingNote(time);
  return projection;
}
