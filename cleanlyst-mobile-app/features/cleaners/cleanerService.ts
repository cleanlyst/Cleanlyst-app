import { supabase } from "@/services/supabase";
import type { Cleaner } from "@/types/cleaner";

export async function searchCleaners(query: string): Promise<Cleaner[]> {
  const { data, error } = await supabase
    .from<Cleaner>("cleaners")
    .select("id, name, hourly_rate, rating")
    .ilike("name", `%${query}%`)
    .limit(20);

  if (error) throw error;
  return data ?? [];
}
