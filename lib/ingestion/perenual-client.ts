const PERENUAL_BASE = "https://perenual.com/api";

export interface PerenualPlant {
  id: number;
  common_name: string;
  scientific_name: string[];
  watering: string | null;
  sunlight: string[];
  hardiness: { min: string; max: string } | null;
}

export async function fetchPerenualPlants(page = 1): Promise<PerenualPlant[]> {
  const key = process.env.PERENUAL_API_KEY;
  if (!key) {
    return [];
  }

  const url = `${PERENUAL_BASE}/species-list?key=${key}&page=${page}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Perenual API error: ${response.status}`);
  }

  const data = (await response.json()) as { data: PerenualPlant[] };
  return data.data ?? [];
}
