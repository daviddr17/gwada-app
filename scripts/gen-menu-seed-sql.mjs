/**
 * Generates supabase/seed_menu_relational.sql from the same logical data as mock-menu.
 * Run: node scripts/gen-menu-seed-sql.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, "..", "supabase", "seed_menu_relational.sql");

const CAT = {
  starters: "b1000000-0000-4000-8000-000000000001",
  mains: "b1000000-0000-4000-8000-000000000002",
  sides: "b1000000-0000-4000-8000-000000000003",
  desserts: "b1000000-0000-4000-8000-000000000004",
  drinks: "b1000000-0000-4000-8000-000000000005",
};
const TAG = {
  vegan: "c2000000-0000-4000-8000-000000000001",
  vegetarian: "c2000000-0000-4000-8000-000000000002",
  spicy: "c2000000-0000-4000-8000-000000000003",
  halal: "c2000000-0000-4000-8000-000000000004",
};
const ALL = {
  gluten: "d3000000-0000-4000-8000-000000000001",
  nuts: "d3000000-0000-4000-8000-000000000002",
  dairy: "d3000000-0000-4000-8000-000000000003",
};

const ITEM_IDS = [
  "f0000000-0000-4000-8000-000000000001",
  "f0000000-0000-4000-8000-000000000002",
  "f0000000-0000-4000-8000-000000000003",
  "f0000000-0000-4000-8000-000000000004",
  "f0000000-0000-4000-8000-000000000005",
  "f0000000-0000-4000-8000-000000000006",
  "f0000000-0000-4000-8000-000000000007",
  "f0000000-0000-4000-8000-000000000008",
  "f0000000-0000-4000-8000-000000000009",
  "f0000000-0000-4000-8000-00000000000a",
  "f0000000-0000-4000-8000-00000000000b",
  "f0000000-0000-4000-8000-00000000000c",
  "f0000000-0000-4000-8000-00000000000d",
  "f0000000-0000-4000-8000-00000000000e",
  "f0000000-0000-4000-8000-00000000000f",
  "f0000000-0000-4000-8000-000000000010",
  "f0000000-0000-4000-8000-000000000011",
  "f0000000-0000-4000-8000-000000000012",
  "f0000000-0000-4000-8000-000000000013",
  "f0000000-0000-4000-8000-000000000014",
  "f0000000-0000-4000-8000-000000000015",
  "f0000000-0000-4000-8000-000000000016",
  "f0000000-0000-4000-8000-000000000017",
  "f0000000-0000-4000-8000-000000000018",
];

const items = [
  {
    name: "Accras de morue",
    description:
      "Knusprige Kabeljau-Bällchen mit pikantem Dip – Klassiker der Antillen.",
    price: 8.5,
    category: "starters",
    imageUrl:
      "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&q=80",
    tags: ["spicy"],
    recipe: [{ ingredientId: "ing-1", amount: 400 }],
  },
  {
    name: "Bokit poulet",
    description:
      "Fluffiges Sandwich-Brot gefüllt mit mariniertem Hähnchen und Sauce chien.",
    price: 9.9,
    category: "starters",
    imageUrl:
      "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&q=80",
    tags: ["spicy"],
  },
  {
    name: "Assiette créole",
    description:
      "Variation aus Salat, Avocado, christophinen und hausgemachtem Dressing.",
    price: 11.5,
    category: "starters",
    imageUrl:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80",
    tags: ["vegan", "vegetarian"],
  },
  {
    name: "Feuilletés bouchot",
    description: "Blätterteig mit Muscheln, Knoblauch und feiner Petersilie.",
    price: 10.5,
    category: "starters",
    imageUrl:
      "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80",
    tags: ["gluten"],
  },
  {
    name: "Colombo de poulet",
    description:
      "Langsam geschmortes Huhn in Colombo-Gewürzmischung mit Gemüse und Reis.",
    price: 18.9,
    category: "mains",
    imageUrl:
      "https://images.unsplash.com/photo-1708782344490-9026aaa5eec7?w=800&q=80",
    tags: ["spicy", "halal"],
  },
  {
    name: "Griot haïtien",
    description:
      "Zart mariniertes Schweinefleisch, knusprig gebraten, mit bananes pesées.",
    price: 19.5,
    category: "mains",
    imageUrl:
      "https://images.unsplash.com/photo-1544025162-d766942659de?w=800&q=80",
    tags: ["spicy"],
  },
  {
    name: "Lambi créole",
    description: "Jakobsmuscheln in leichter Tomaten-Kokos-Sauce mit Kräutern.",
    price: 24.9,
    category: "mains",
    imageUrl:
      "https://images.unsplash.com/photo-1559847844-5315695dadae?w=800&q=80",
    tags: [],
  },
  {
    name: "Poulet boucané",
    description:
      "Rauchig gegrilltes Hähnchen mit Zitrus-Marinade und pikantem Rub.",
    price: 17.5,
    category: "mains",
    imageUrl:
      "https://images.unsplash.com/photo-1598103442097-8b74394dd95d?w=800&q=80",
    tags: ["spicy", "halal"],
  },
  {
    name: "Cabri colombo",
    description: "Ziegenfleisch-Eintopf mit Colombo, Kartoffeln und Thymian.",
    price: 21.9,
    category: "mains",
    imageUrl:
      "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=800&q=80",
    tags: ["spicy", "halal"],
  },
  {
    name: "Poisson braisé",
    description:
      "Ganzer Dorade am Grill mit Escovitch-Zwiebeln und Beilagensalat.",
    price: 22.5,
    category: "mains",
    imageUrl:
      "https://images.unsplash.com/photo-1519708227412-c8fd9a32b1a8?w=800&q=80",
    tags: ["spicy"],
  },
  {
    name: "Ragoût de bœuf",
    description: "Langsam geschmortes Rind mit Wurzelgemüse und Gewürznelken.",
    price: 20.5,
    category: "mains",
    imageUrl:
      "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&q=80",
    tags: [],
  },
  {
    name: "Bananes pesées",
    description: "Zweimal gebratene Kochbananen – knusprig außen, weich innen.",
    price: 6.5,
    category: "sides",
    imageUrl:
      "https://images.unsplash.com/photo-1571771894821-ce9ba11b0e19?w=800&q=80",
    tags: ["vegan", "vegetarian"],
  },
  {
    name: "Riz colonial",
    description: "Duftender Langkornreis mit Thymian, Knoblauch und Erbsen.",
    price: 5.5,
    category: "sides",
    imageUrl:
      "https://images.unsplash.com/photo-1586201375761-ab2e7d1d2c47?w=800&q=80",
    tags: ["vegan", "vegetarian", "gluten"],
  },
  {
    name: "Féroce avocat",
    description:
      "Cremige Avocado-Mousse mit gesalzenem Kabeljau und Manioc.",
    price: 7.9,
    category: "sides",
    imageUrl:
      "https://images.unsplash.com/photo-1523049673857-9c1effa0adb6?w=800&q=80",
    tags: ["spicy"],
  },
  {
    name: "Accras légumes",
    description: "Frittierte Gemüse-Bällchen mit Kräuter-Dip – vegan & knusprig.",
    price: 7.5,
    category: "sides",
    imageUrl:
      "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80",
    tags: ["vegan", "vegetarian", "spicy"],
  },
  {
    name: "Tarte coco",
    description: "Buttriger Mürbeteig mit cremiger Kokosfüllung und Karamell.",
    price: 7.9,
    category: "desserts",
    imageUrl:
      "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=800&q=80",
    tags: ["vegetarian", "dairy", "gluten", "nuts"],
  },
  {
    name: "Flan coco antillais",
    description: "Seidiger Kokos-Flan mit Vanille und gerösteter Kokosraspel.",
    price: 6.9,
    category: "desserts",
    imageUrl:
      "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&q=80",
    tags: ["vegetarian", "dairy"],
  },
  {
    name: "Sorbet passion",
    description: "Erfrischendes Maracuja-Sorbet mit Minze – leicht & fruchtig.",
    price: 5.9,
    category: "desserts",
    imageUrl:
      "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80",
    tags: ["vegan", "vegetarian"],
  },
  {
    name: "Banane flambée",
    description: "Karamellisierte Banane mit Rum und Vanilleeis.",
    price: 8.5,
    category: "desserts",
    imageUrl:
      "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&q=80",
    tags: ["vegetarian", "dairy"],
  },
  {
    name: "Ti-punch",
    description: "Rhumerie-klassisch: Rhum agricole, Limette, Rohrzucker.",
    price: 9.5,
    category: "drinks",
    imageUrl:
      "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d44?w=800&q=80",
    tags: ["vegan", "vegetarian"],
  },
  {
    name: "Sorrel drink",
    description: "Erfrischender Hibiskus-Sirup mit Gewürznelke und Ingwer.",
    price: 5.5,
    category: "drinks",
    imageUrl:
      "https://images.unsplash.com/photo-1546173159-315724a31696?w=800&q=80",
    tags: ["vegan", "vegetarian"],
  },
  {
    name: "Jus de goyave",
    description: "Frisch gepresster Guaven-Saft – süß, aromatisch, eiskalt.",
    price: 4.9,
    category: "drinks",
    imageUrl:
      "https://images.unsplash.com/photo-1622597467838-cfdf208fbccf?w=800&q=80",
    tags: ["vegan", "vegetarian"],
  },
  {
    name: "Punch coco",
    description: "Cremiger Kokos-Punch mit Rum und Muskatnuss.",
    price: 10.5,
    category: "drinks",
    imageUrl:
      "https://images.unsplash.com/photo-1551024709-8f9b28c1a2c3?w=800&q=80",
    tags: ["vegetarian", "dairy"],
  },
  {
    name: "Café gwo gousse",
    description: "Starker Antillen-Espresso mit Kakaonote und Rohrzucker.",
    price: 3.9,
    category: "drinks",
    imageUrl:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80",
    tags: ["vegan", "vegetarian"],
  },
];

function esc(s) {
  return String(s).replace(/'/g, "''");
}

const tagDefs = [
  ["vegan", "Vegan", "#059669", 0],
  ["vegetarian", "Vegetarisch", "#16a34a", 1],
  ["spicy", "Spicy", "#ea580c", 2],
  ["halal", "Halal", "#ca8a04", 3],
];
const allergenDefs = [
  ["gluten", "Gluten", "#d97706", 0],
  ["nuts", "Nüsse", "#ca8a04", 1],
  ["dairy", "Milch", "#0284c7", 2],
];

const catRows = [
  ["starters", "Vorspeisen", 0],
  ["mains", "Hauptgerichte", 1],
  ["sides", "Beilagen", 2],
  ["desserts", "Desserts", 3],
  ["drinks", "Getränke", 4],
];

let sql = `-- Generated by scripts/gen-menu-seed-sql.mjs — do not edit by hand; re-run the script.
-- Depends on public.restaurants row with slug gwada-demo (seed.sql).

do $$
declare
  rid uuid;
begin
  select id into rid from public.restaurants where slug = 'gwada-demo' limit 1;
  if rid is null then
    raise notice 'seed_menu_relational: no gwada-demo restaurant, skip';
    return;
  end if;

  insert into public.menu_categories (id, restaurant_id, name, sort_order, is_active) values
`;

sql += catRows
  .map(
    ([key, name, ord]) =>
      `    ('${CAT[key]}', rid, '${esc(name)}', ${ord}, true)`,
  )
  .join(",\n");

sql += `
  on conflict (id) do nothing;

  insert into public.menu_tags (id, restaurant_id, name, background_color, sort_order, is_active) values
`;

sql += tagDefs
  .map(([key, name, col, ord]) => {
    const id = TAG[key];
    return `    ('${id}', rid, '${esc(name)}', '${esc(col)}', ${ord}, true)`;
  })
  .join(",\n");

sql += `
  on conflict (id) do nothing;

  insert into public.menu_allergens (id, restaurant_id, name, background_color, sort_order, is_active) values
`;

sql += allergenDefs
  .map(([key, name, col, ord]) => {
    const id = ALL[key];
    return `    ('${id}', rid, '${esc(name)}', '${esc(col)}', ${ord}, true)`;
  })
  .join(",\n");

sql += `
  on conflict (id) do nothing;

`;

sql += `  insert into public.menu_items (id, restaurant_id, category_id, name, description, price, image_url, is_active, list_number) values\n`;

const itemValues = items.map((it, i) => {
  const cid = CAT[it.category];
  const id = ITEM_IDS[i];
  return `    ('${id}', rid, '${cid}', '${esc(it.name)}', '${esc(it.description)}', ${it.price}, '${esc(it.imageUrl)}', true, null)`;
});
sql += itemValues.join(",\n");
sql += `
  on conflict (id) do nothing;

`;

const tagLinks = [];
const allergenLinks = [];
for (let i = 0; i < items.length; i++) {
  const mid = ITEM_IDS[i];
  for (const t of items[i].tags) {
    if (TAG[t]) tagLinks.push(`    ('${mid}', '${TAG[t]}')`);
    else if (ALL[t]) allergenLinks.push(`    ('${mid}', '${ALL[t]}')`);
  }
}

if (tagLinks.length) {
  sql += `  insert into public.menu_item_tags (menu_item_id, tag_id) values\n${tagLinks.join(",\n")}\n  on conflict (menu_item_id, tag_id) do nothing;\n\n`;
}
if (allergenLinks.length) {
  sql += `  insert into public.menu_item_allergens (menu_item_id, allergen_id) values\n${allergenLinks.join(",\n")}\n  on conflict (menu_item_id, allergen_id) do nothing;\n\n`;
}

sql += `  insert into public.menu_item_recipe_lines (menu_item_id, ingredient_id, amount, sort_order) values
    ('${ITEM_IDS[0]}', 'ing-1', 400, 0)
  on conflict (menu_item_id, ingredient_id) do nothing;

end $$;
`;

writeFileSync(out, sql, "utf8");
console.log("Wrote", out);
