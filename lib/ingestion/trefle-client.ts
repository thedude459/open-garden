const TREFLE_BASE = "https://trefle.io/api/v1";

export interface TreflePlant {
  id: number;
  common_name: string | null;
  scientific_name: string;
  family: string | null;
}

export async function fetchTreflePlants(page = 1): Promise<TreflePlant[]> {
  const token = process.env.TREFLE_API_TOKEN;
  if (!token) {
    return [];
  }

  const url = `${TREFLE_BASE}/plants?token=${token}&page=${page}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Trefle API error: ${response.status}`);
  }

  const data = (await response.json()) as { data: TreflePlant[] };
  return data.data ?? [];
}

export async function fetchTreflePlantById(id: number): Promise<TreflePlant | null> {
  const token = process.env.TREFLE_API_TOKEN;
  if (!token) {
    return null;
  }

  const response = await fetch(`${TREFLE_BASE}/plants/${id}?token=${token}`);
  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { data: TreflePlant };
  return data.data ?? null;
}
