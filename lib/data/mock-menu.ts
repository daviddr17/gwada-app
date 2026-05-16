import type { MenuItem } from "@/lib/types/menu";

export const mockMenu: MenuItem[] = [
  {
    id: "1",
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
    id: "2",
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
    id: "3",
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
    id: "4",
    name: "Feuilletés bouchot",
    description: "Blätterteig mit Muscheln, Knoblauch und feiner Petersilie.",
    price: 10.5,
    category: "starters",
    imageUrl:
      "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80",
    tags: ["gluten"],
  },
  {
    id: "5",
    name: "Colombo de poulet",
    description:
      "Langsam geschmortes Huhn in Colombo-Gewürzmischung mit Gemüse und Reis.",
    price: 18.9,
    category: "mains",
    imageUrl:
      "https://images.unsplash.com/photo-1604908177524-90947bb293e3?w=800&q=80",
    tags: ["spicy", "halal"],
  },
  {
    id: "6",
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
    id: "7",
    name: "Lambi créole",
    description: "Jakobsmuscheln in leichter Tomaten-Kokos-Sauce mit Kräutern.",
    price: 24.9,
    category: "mains",
    imageUrl:
      "https://images.unsplash.com/photo-1559847844-5315695dadae?w=800&q=80",
    tags: [],
  },
  {
    id: "8",
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
    id: "9",
    name: "Cabri colombo",
    description: "Ziegenfleisch-Eintopf mit Colombo, Kartoffeln und Thymian.",
    price: 21.9,
    category: "mains",
    imageUrl:
      "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=800&q=80",
    tags: ["spicy", "halal"],
  },
  {
    id: "10",
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
    id: "11",
    name: "Ragoût de bœuf",
    description: "Langsam geschmortes Rind mit Wurzelgemüse und Gewürznelken.",
    price: 20.5,
    category: "mains",
    imageUrl:
      "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&q=80",
    tags: [],
  },
  {
    id: "12",
    name: "Bananes pesées",
    description: "Zweimal gebratene Kochbananen – knusprig außen, weich innen.",
    price: 6.5,
    category: "sides",
    imageUrl:
      "https://images.unsplash.com/photo-1571771894821-ce9ba11b0e19?w=800&q=80",
    tags: ["vegan", "vegetarian"],
  },
  {
    id: "13",
    name: "Riz colonial",
    description: "Duftender Langkornreis mit Thymian, Knoblauch und Erbsen.",
    price: 5.5,
    category: "sides",
    imageUrl:
      "https://images.unsplash.com/photo-1586201375761-ab2e7d1d2c47?w=800&q=80",
    tags: ["vegan", "vegetarian", "gluten"],
  },
  {
    id: "14",
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
    id: "15",
    name: "Accras légumes",
    description: "Frittierte Gemüse-Bällchen mit Kräuter-Dip – vegan & knusprig.",
    price: 7.5,
    category: "sides",
    imageUrl:
      "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80",
    tags: ["vegan", "vegetarian", "spicy"],
  },
  {
    id: "16",
    name: "Tarte coco",
    description: "Buttriger Mürbeteig mit cremiger Kokosfüllung und Karamell.",
    price: 7.9,
    category: "desserts",
    imageUrl:
      "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=800&q=80",
    tags: ["vegetarian", "dairy", "gluten", "nuts"],
  },
  {
    id: "17",
    name: "Flan coco antillais",
    description: "Seidiger Kokos-Flan mit Vanille und gerösteter Kokosraspel.",
    price: 6.9,
    category: "desserts",
    imageUrl:
      "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&q=80",
    tags: ["vegetarian", "dairy"],
  },
  {
    id: "18",
    name: "Sorbet passion",
    description: "Erfrischendes Maracuja-Sorbet mit Minze – leicht & fruchtig.",
    price: 5.9,
    category: "desserts",
    imageUrl:
      "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800&q=80",
    tags: ["vegan", "vegetarian"],
  },
  {
    id: "19",
    name: "Banane flambée",
    description: "Karamellisierte Banane mit Rum und Vanilleeis.",
    price: 8.5,
    category: "desserts",
    imageUrl:
      "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&q=80",
    tags: ["vegetarian", "dairy"],
  },
  {
    id: "20",
    name: "Ti-punch",
    description: "Rhumerie-klassisch: Rhum agricole, Limette, Rohrzucker.",
    price: 9.5,
    category: "drinks",
    imageUrl:
      "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d44?w=800&q=80",
    tags: ["vegan", "vegetarian"],
  },
  {
    id: "21",
    name: "Sorrel drink",
    description: "Erfrischender Hibiskus-Sirup mit Gewürznelke und Ingwer.",
    price: 5.5,
    category: "drinks",
    imageUrl:
      "https://images.unsplash.com/photo-1546173159-315724a31696?w=800&q=80",
    tags: ["vegan", "vegetarian"],
  },
  {
    id: "22",
    name: "Jus de goyave",
    description: "Frisch gepresster Guaven-Saft – süß, aromatisch, eiskalt.",
    price: 4.9,
    category: "drinks",
    imageUrl:
      "https://images.unsplash.com/photo-1622597467838-cfdf208fbccf?w=800&q=80",
    tags: ["vegan", "vegetarian"],
  },
  {
    id: "23",
    name: "Punch coco",
    description: "Cremiger Kokos-Punch mit Rum und Muskatnuss.",
    price: 10.5,
    category: "drinks",
    imageUrl:
      "https://images.unsplash.com/photo-1551024709-8f9b28c1a2c3?w=800&q=80",
    tags: ["vegetarian", "dairy"],
  },
  {
    id: "24",
    name: "Café gwo gousse",
    description: "Starker Antillen-Espresso mit Kakaonote und Rohrzucker.",
    price: 3.9,
    category: "drinks",
    imageUrl:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80",
    tags: ["vegan", "vegetarian"],
  },
];
