function calcInterestRate(tenureMonths, purpose) {
  if (purpose === 'business') return 0.155;
  if (tenureMonths <= 12) return 0.125;
  if (tenureMonths <= 24) return 0.145;
  return 0.165;
}

function monthlyPayment(principal, annualRate, months) {
  if (months <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return principal / months;
  const numerator = principal * r * Math.pow(1 + r, months);
  const denominator = Math.pow(1 + r, months) - 1;
  return numerator / denominator;
}

module.exports = {
  calcInterestRate,
  monthlyPayment,
};
