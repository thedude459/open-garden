export function isoDate(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromIsoDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

export function monthTitle(value: Date) {
  return value.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
