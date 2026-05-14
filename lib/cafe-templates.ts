import { authClient } from './supabase-auth'

export type TemplateItem = {
  product_name: string
  product_name_th: string
  product_name_lo: string
  price_lak: number
  category_id: string
  emoji: string
}

export type TemplateIngredient = {
  name: string
  name_th: string
  name_lo: string
  unit: string
  current_qty: number
  cost_per_unit: number
}

export type TemplateRecipeLink = {
  recipe_name: string        // matches product_name in items
  ingredient_name: string    // matches name in ingredients
  qty_required: number
  unit: string
}

export type CafeTemplate = {
  id: string
  name: string
  name_th: string
  emoji: string
  description: string
  description_th: string
  items: TemplateItem[]
  ingredients: TemplateIngredient[]
  recipeLinks: TemplateRecipeLink[]
}

// ── Seeded category IDs from migration 005_categories ─────────────────────────
const CAT_COFFEE  = 'ca000000-0000-0000-0000-000000000001'
const CAT_HOT     = 'ca000000-0000-0000-0000-000000000003'
const CAT_ICED    = 'ca000000-0000-0000-0000-000000000004'
const CAT_BAKERY  = 'ca000000-0000-0000-0000-000000000005'

// ── Templates ──────────────────────────────────────────────────────────────────

export const CAFE_TEMPLATES: CafeTemplate[] = [
  {
    id: 'modern',
    name: 'Modern Coffee Shop',
    name_th: 'คาเฟ่สมัยใหม่',
    emoji: '☕',
    description: 'International coffee menu with espresso base and pastries',
    description_th: 'เมนูกาแฟสากล — เอสเปรสโซ ลาเต้ ขนมอบ',
    items: [
      { product_name: 'Espresso',      product_name_th: 'เอสเปรสโซ',     product_name_lo: 'ເອສເປຣໂຊ',     price_lak: 15000, category_id: CAT_HOT,    emoji: '☕' },
      { product_name: 'Americano',     product_name_th: 'อเมริกาโน่',     product_name_lo: 'ອາເມຣິກາໂນ',   price_lak: 18000, category_id: CAT_HOT,    emoji: '☕' },
      { product_name: 'Latte',         product_name_th: 'ลาเต้',          product_name_lo: 'ລາເຕ້',         price_lak: 22000, category_id: CAT_HOT,    emoji: '☕' },
      { product_name: 'Cappuccino',    product_name_th: 'คาปูชิโน่',      product_name_lo: 'ຄາປູຊິໂນ',      price_lak: 22000, category_id: CAT_HOT,    emoji: '☕' },
      { product_name: 'Mocha',         product_name_th: 'มอคค่า',         product_name_lo: 'ມໍຄາ',          price_lak: 25000, category_id: CAT_HOT,    emoji: '☕' },
      { product_name: 'Matcha Latte',  product_name_th: 'มัตชะ ลาเต้',    product_name_lo: 'ມັດຊະ ລາເຕ້',   price_lak: 28000, category_id: CAT_HOT,    emoji: '🍵' },
      { product_name: 'Iced Coffee',   product_name_th: 'กาแฟเย็น',       product_name_lo: 'ກາເຟເຢັນ',      price_lak: 20000, category_id: CAT_ICED,   emoji: '🧊' },
      { product_name: 'Iced Latte',    product_name_th: 'ลาเต้เย็น',      product_name_lo: 'ລາເຕ້ເຢັນ',     price_lak: 23000, category_id: CAT_ICED,   emoji: '🧊' },
      { product_name: 'Iced Green Tea',product_name_th: 'ชาเขียวเย็น',    product_name_lo: 'ຊາຂຽວເຢັນ',     price_lak: 18000, category_id: CAT_ICED,   emoji: '🍵' },
      { product_name: 'Thai Tea',      product_name_th: 'ชาไทย',          product_name_lo: 'ຊາໄທ',          price_lak: 18000, category_id: CAT_ICED,   emoji: '🧡' },
      { product_name: 'Croissant',     product_name_th: 'ครัวซองต์',      product_name_lo: 'ຄຣົວຊອງ',       price_lak: 25000, category_id: CAT_BAKERY, emoji: '🥐' },
      { product_name: 'Cake Slice',    product_name_th: 'เค้ก',           product_name_lo: 'ເຄ້ກ',          price_lak: 35000, category_id: CAT_BAKERY, emoji: '🎂' },
    ],
    ingredients: [
      { name: 'Coffee beans', name_th: 'เมล็ดกาแฟ',      name_lo: 'ເມັດກາເຟ',    unit: 'g',  current_qty: 1000, cost_per_unit: 80  },
      { name: 'Fresh milk',   name_th: 'นมสด',            name_lo: 'ນົມສົດ',      unit: 'ml', current_qty: 5000, cost_per_unit: 8   },
      { name: 'Sugar',        name_th: 'น้ำตาล',          name_lo: 'ນ້ຳຕານ',     unit: 'g',  current_qty: 2000, cost_per_unit: 5   },
      { name: 'Tea leaves',   name_th: 'ใบชา',            name_lo: 'ໃບຊາ',       unit: 'g',  current_qty: 500,  cost_per_unit: 50  },
      { name: 'Matcha powder',name_th: 'มัตชะ',           name_lo: 'ມັດຊະ',      unit: 'g',  current_qty: 200,  cost_per_unit: 200 },
      { name: 'Cocoa powder', name_th: 'ผงโกโก้',         name_lo: 'ຜົງໂກໂກ',    unit: 'g',  current_qty: 500,  cost_per_unit: 30  },
      { name: 'Syrup',        name_th: 'น้ำเชื่อม',       name_lo: 'ນ້ຳຫວານ',    unit: 'ml', current_qty: 2000, cost_per_unit: 10  },
      { name: 'Ice',          name_th: 'น้ำแข็ง',         name_lo: 'ນ້ຳກ້ອນ',    unit: 'g',  current_qty: 5000, cost_per_unit: 1   },
    ],
    recipeLinks: [
      { recipe_name: 'Espresso',      ingredient_name: 'Coffee beans', qty_required: 18,  unit: 'g'  },
      { recipe_name: 'Americano',     ingredient_name: 'Coffee beans', qty_required: 18,  unit: 'g'  },
      { recipe_name: 'Latte',         ingredient_name: 'Coffee beans', qty_required: 18,  unit: 'g'  },
      { recipe_name: 'Latte',         ingredient_name: 'Fresh milk',   qty_required: 200, unit: 'ml' },
      { recipe_name: 'Cappuccino',    ingredient_name: 'Coffee beans', qty_required: 18,  unit: 'g'  },
      { recipe_name: 'Cappuccino',    ingredient_name: 'Fresh milk',   qty_required: 150, unit: 'ml' },
      { recipe_name: 'Mocha',         ingredient_name: 'Coffee beans', qty_required: 18,  unit: 'g'  },
      { recipe_name: 'Mocha',         ingredient_name: 'Cocoa powder', qty_required: 15,  unit: 'g'  },
      { recipe_name: 'Mocha',         ingredient_name: 'Fresh milk',   qty_required: 180, unit: 'ml' },
      { recipe_name: 'Matcha Latte',  ingredient_name: 'Matcha powder',qty_required: 8,   unit: 'g'  },
      { recipe_name: 'Matcha Latte',  ingredient_name: 'Fresh milk',   qty_required: 200, unit: 'ml' },
      { recipe_name: 'Iced Coffee',   ingredient_name: 'Coffee beans', qty_required: 20,  unit: 'g'  },
      { recipe_name: 'Iced Coffee',   ingredient_name: 'Ice',          qty_required: 200, unit: 'g'  },
      { recipe_name: 'Iced Latte',    ingredient_name: 'Coffee beans', qty_required: 20,  unit: 'g'  },
      { recipe_name: 'Iced Latte',    ingredient_name: 'Fresh milk',   qty_required: 180, unit: 'ml' },
      { recipe_name: 'Iced Latte',    ingredient_name: 'Ice',          qty_required: 200, unit: 'g'  },
      { recipe_name: 'Iced Green Tea',ingredient_name: 'Tea leaves',   qty_required: 5,   unit: 'g'  },
      { recipe_name: 'Iced Green Tea',ingredient_name: 'Ice',          qty_required: 200, unit: 'g'  },
      { recipe_name: 'Thai Tea',      ingredient_name: 'Tea leaves',   qty_required: 8,   unit: 'g'  },
      { recipe_name: 'Thai Tea',      ingredient_name: 'Ice',          qty_required: 200, unit: 'g'  },
    ],
  },
  {
    id: 'lao',
    name: 'Lao Local Cafe',
    name_th: 'คาเฟ่สไตล์ลาว',
    emoji: '🇱🇦',
    description: 'Traditional Lao coffee with local specialties',
    description_th: 'กาแฟลาวแท้ — กาแฟสด นมข้นหวาน ชาลาว',
    items: [
      { product_name: 'Lao Black Coffee',    product_name_th: 'กาแฟดำลาว',     product_name_lo: 'ກາເຟດຳລາວ',    price_lak: 12000, category_id: CAT_HOT,  emoji: '☕' },
      { product_name: 'Lao Coffee + Milk',   product_name_th: 'กาแฟนมสด',      product_name_lo: 'ກາເຟນົມ',      price_lak: 15000, category_id: CAT_HOT,  emoji: '☕' },
      { product_name: 'Condensed Milk Coffee',product_name_th: 'กาแฟนมข้น',    product_name_lo: 'ກາເຟນົມຂົ້ນ',  price_lak: 15000, category_id: CAT_HOT,  emoji: '☕' },
      { product_name: 'Lao Tea Hot',         product_name_th: 'ชาลาวร้อน',     product_name_lo: 'ຊາລາວຮ້ອນ',    price_lak: 10000, category_id: CAT_HOT,  emoji: '🍵' },
      { product_name: 'Iced Lao Coffee',     product_name_th: 'กาแฟดำลาวเย็น', product_name_lo: 'ກາເຟດຳລາວເຢັນ',price_lak: 15000, category_id: CAT_ICED, emoji: '🧊' },
      { product_name: 'Iced Condensed Milk Coffee', product_name_th: 'กาแฟนมข้นเย็น', product_name_lo: 'ກາເຟນົມຂົ້ນເຢັນ', price_lak: 18000, category_id: CAT_ICED, emoji: '🧊' },
      { product_name: 'Iced Lao Tea',        product_name_th: 'ชาลาวเย็น',     product_name_lo: 'ຊາລາວເຢັນ',    price_lak: 12000, category_id: CAT_ICED, emoji: '🍵' },
      { product_name: 'Fresh Orange Juice',  product_name_th: 'น้ำส้มสด',      product_name_lo: 'ນ້ຳໝາກກ້ຽງ',   price_lak: 18000, category_id: CAT_ICED, emoji: '🍊' },
      { product_name: 'Sticky Rice + Mango', product_name_th: 'ข้าวเหนียวมะม่วง', product_name_lo: 'ເຂົ້າໜຽວຫມາກມ່ວງ', price_lak: 25000, category_id: CAT_BAKERY, emoji: '🥭' },
      { product_name: 'Banana Cake',         product_name_th: 'เค้กกล้วย',      product_name_lo: 'ເຄ້ກຫມາກກ້ວຍ', price_lak: 20000, category_id: CAT_BAKERY, emoji: '🍌' },
    ],
    ingredients: [
      { name: 'Lao coffee beans',  name_th: 'เมล็ดกาแฟลาว',   name_lo: 'ເມັດກາເຟລາວ',  unit: 'g',  current_qty: 1000, cost_per_unit: 60  },
      { name: 'Condensed milk',    name_th: 'นมข้นหวาน',        name_lo: 'ນົມຂົ້ນ',      unit: 'ml', current_qty: 2000, cost_per_unit: 15  },
      { name: 'Fresh milk',        name_th: 'นมสด',             name_lo: 'ນົມສົດ',       unit: 'ml', current_qty: 3000, cost_per_unit: 8   },
      { name: 'Tea leaves',        name_th: 'ใบชา',             name_lo: 'ໃບຊາ',        unit: 'g',  current_qty: 500,  cost_per_unit: 50  },
      { name: 'Sugar',             name_th: 'น้ำตาล',           name_lo: 'ນ້ຳຕານ',      unit: 'g',  current_qty: 2000, cost_per_unit: 5   },
      { name: 'Ice',               name_th: 'น้ำแข็ง',          name_lo: 'ນ້ຳກ້ອນ',     unit: 'g',  current_qty: 5000, cost_per_unit: 1   },
    ],
    recipeLinks: [
      { recipe_name: 'Lao Black Coffee',         ingredient_name: 'Lao coffee beans', qty_required: 15,  unit: 'g'  },
      { recipe_name: 'Lao Coffee + Milk',        ingredient_name: 'Lao coffee beans', qty_required: 15,  unit: 'g'  },
      { recipe_name: 'Lao Coffee + Milk',        ingredient_name: 'Fresh milk',       qty_required: 150, unit: 'ml' },
      { recipe_name: 'Condensed Milk Coffee',    ingredient_name: 'Lao coffee beans', qty_required: 15,  unit: 'g'  },
      { recipe_name: 'Condensed Milk Coffee',    ingredient_name: 'Condensed milk',   qty_required: 50,  unit: 'ml' },
      { recipe_name: 'Iced Lao Coffee',          ingredient_name: 'Lao coffee beans', qty_required: 18,  unit: 'g'  },
      { recipe_name: 'Iced Lao Coffee',          ingredient_name: 'Ice',              qty_required: 200, unit: 'g'  },
      { recipe_name: 'Iced Condensed Milk Coffee',ingredient_name: 'Lao coffee beans',qty_required: 18,  unit: 'g'  },
      { recipe_name: 'Iced Condensed Milk Coffee',ingredient_name: 'Condensed milk',  qty_required: 60,  unit: 'ml' },
      { recipe_name: 'Iced Condensed Milk Coffee',ingredient_name: 'Ice',             qty_required: 200, unit: 'g'  },
      { recipe_name: 'Lao Tea Hot',              ingredient_name: 'Tea leaves',       qty_required: 5,   unit: 'g'  },
      { recipe_name: 'Iced Lao Tea',             ingredient_name: 'Tea leaves',       qty_required: 5,   unit: 'g'  },
      { recipe_name: 'Iced Lao Tea',             ingredient_name: 'Ice',              qty_required: 200, unit: 'g'  },
    ],
  },
  {
    id: 'tourist',
    name: 'Tourist Cafe',
    name_th: 'คาเฟ่นักท่องเที่ยว',
    emoji: '🌍',
    description: 'International + Lao mix — perfect for Attapeu travelers',
    description_th: 'ผสมสากลและลาว — เหมาะสำหรับนักท่องเที่ยวอัตตะปือ',
    items: [
      { product_name: 'Espresso',         product_name_th: 'เอสเปรสโซ',    product_name_lo: 'ເອສເປຣໂຊ',     price_lak: 15000, category_id: CAT_HOT,    emoji: '☕' },
      { product_name: 'Latte',            product_name_th: 'ลาเต้',         product_name_lo: 'ລາເຕ້',         price_lak: 25000, category_id: CAT_HOT,    emoji: '☕' },
      { product_name: 'Cappuccino',       product_name_th: 'คาปูชิโน่',     product_name_lo: 'ຄາປູຊິໂນ',      price_lak: 25000, category_id: CAT_HOT,    emoji: '☕' },
      { product_name: 'Lao Black Coffee', product_name_th: 'กาแฟดำลาว',    product_name_lo: 'ກາເຟດຳລາວ',     price_lak: 12000, category_id: CAT_HOT,    emoji: '☕' },
      { product_name: 'Lao Milk Coffee',  product_name_th: 'กาแฟนมลาว',    product_name_lo: 'ກາເຟນົມລາວ',    price_lak: 16000, category_id: CAT_HOT,    emoji: '☕' },
      { product_name: 'Matcha Latte',     product_name_th: 'มัตชะ ลาเต้',   product_name_lo: 'ມັດຊະ ລາເຕ້',   price_lak: 28000, category_id: CAT_HOT,    emoji: '🍵' },
      { product_name: 'Iced Coffee',      product_name_th: 'กาแฟเย็น',      product_name_lo: 'ກາເຟເຢັນ',      price_lak: 22000, category_id: CAT_ICED,   emoji: '🧊' },
      { product_name: 'Iced Latte',       product_name_th: 'ลาเต้เย็น',     product_name_lo: 'ລາເຕ້ເຢັນ',     price_lak: 26000, category_id: CAT_ICED,   emoji: '🧊' },
      { product_name: 'Thai Tea',         product_name_th: 'ชาไทย',         product_name_lo: 'ຊາໄທ',          price_lak: 20000, category_id: CAT_ICED,   emoji: '🧡' },
      { product_name: 'Iced Lao Tea',     product_name_th: 'ชาลาวเย็น',     product_name_lo: 'ຊາລາວເຢັນ',     price_lak: 14000, category_id: CAT_ICED,   emoji: '🍵' },
      { product_name: 'Fresh Lime Juice', product_name_th: 'น้ำมะนาว',      product_name_lo: 'ນ້ຳໝາກນາວ',     price_lak: 18000, category_id: CAT_ICED,   emoji: '🍋' },
      { product_name: 'Coconut Smoothie', product_name_th: 'สมูทตี้มะพร้าว', product_name_lo: 'ໝາກພ້າວ Smoothie', price_lak: 30000, category_id: CAT_ICED, emoji: '🥥' },
      { product_name: 'Croissant',        product_name_th: 'ครัวซองต์',     product_name_lo: 'ຄຣົວຊອງ',       price_lak: 28000, category_id: CAT_BAKERY, emoji: '🥐' },
      { product_name: 'Banana Cake',      product_name_th: 'เค้กกล้วย',     product_name_lo: 'ເຄ້ກຫມາກກ້ວຍ', price_lak: 22000, category_id: CAT_BAKERY, emoji: '🍌' },
      { product_name: 'Cake Slice',       product_name_th: 'เค้ก',          product_name_lo: 'ເຄ້ກ',          price_lak: 35000, category_id: CAT_BAKERY, emoji: '🎂' },
    ],
    ingredients: [
      { name: 'Coffee beans',  name_th: 'เมล็ดกาแฟ',    name_lo: 'ເມັດກາເຟ',   unit: 'g',  current_qty: 1000, cost_per_unit: 80  },
      { name: 'Fresh milk',    name_th: 'นมสด',          name_lo: 'ນົມສົດ',     unit: 'ml', current_qty: 5000, cost_per_unit: 8   },
      { name: 'Condensed milk',name_th: 'นมข้นหวาน',    name_lo: 'ນົມຂົ້ນ',    unit: 'ml', current_qty: 1000, cost_per_unit: 15  },
      { name: 'Tea leaves',    name_th: 'ใบชา',          name_lo: 'ໃບຊາ',      unit: 'g',  current_qty: 500,  cost_per_unit: 50  },
      { name: 'Matcha powder', name_th: 'มัตชะ',         name_lo: 'ມັດຊະ',     unit: 'g',  current_qty: 200,  cost_per_unit: 200 },
      { name: 'Coconut milk',  name_th: 'กะทิ',          name_lo: 'ນ້ຳໝາກພ້າວ', unit: 'ml', current_qty: 2000, cost_per_unit: 12  },
      { name: 'Sugar',         name_th: 'น้ำตาล',        name_lo: 'ນ້ຳຕານ',    unit: 'g',  current_qty: 2000, cost_per_unit: 5   },
      { name: 'Ice',           name_th: 'น้ำแข็ง',       name_lo: 'ນ້ຳກ້ອນ',   unit: 'g',  current_qty: 5000, cost_per_unit: 1   },
    ],
    recipeLinks: [
      { recipe_name: 'Espresso',         ingredient_name: 'Coffee beans', qty_required: 18,  unit: 'g'  },
      { recipe_name: 'Latte',            ingredient_name: 'Coffee beans', qty_required: 18,  unit: 'g'  },
      { recipe_name: 'Latte',            ingredient_name: 'Fresh milk',   qty_required: 200, unit: 'ml' },
      { recipe_name: 'Cappuccino',       ingredient_name: 'Coffee beans', qty_required: 18,  unit: 'g'  },
      { recipe_name: 'Cappuccino',       ingredient_name: 'Fresh milk',   qty_required: 150, unit: 'ml' },
      { recipe_name: 'Lao Black Coffee', ingredient_name: 'Coffee beans', qty_required: 15,  unit: 'g'  },
      { recipe_name: 'Lao Milk Coffee',  ingredient_name: 'Coffee beans', qty_required: 15,  unit: 'g'  },
      { recipe_name: 'Lao Milk Coffee',  ingredient_name: 'Condensed milk', qty_required: 50, unit: 'ml' },
      { recipe_name: 'Matcha Latte',     ingredient_name: 'Matcha powder',qty_required: 8,   unit: 'g'  },
      { recipe_name: 'Matcha Latte',     ingredient_name: 'Fresh milk',   qty_required: 200, unit: 'ml' },
      { recipe_name: 'Iced Coffee',      ingredient_name: 'Coffee beans', qty_required: 20,  unit: 'g'  },
      { recipe_name: 'Iced Coffee',      ingredient_name: 'Ice',          qty_required: 200, unit: 'g'  },
      { recipe_name: 'Iced Latte',       ingredient_name: 'Coffee beans', qty_required: 20,  unit: 'g'  },
      { recipe_name: 'Iced Latte',       ingredient_name: 'Fresh milk',   qty_required: 180, unit: 'ml' },
      { recipe_name: 'Iced Latte',       ingredient_name: 'Ice',          qty_required: 200, unit: 'g'  },
      { recipe_name: 'Thai Tea',         ingredient_name: 'Tea leaves',   qty_required: 8,   unit: 'g'  },
      { recipe_name: 'Thai Tea',         ingredient_name: 'Ice',          qty_required: 200, unit: 'g'  },
      { recipe_name: 'Iced Lao Tea',     ingredient_name: 'Tea leaves',   qty_required: 5,   unit: 'g'  },
      { recipe_name: 'Iced Lao Tea',     ingredient_name: 'Ice',          qty_required: 200, unit: 'g'  },
      { recipe_name: 'Coconut Smoothie', ingredient_name: 'Coconut milk', qty_required: 250, unit: 'ml' },
      { recipe_name: 'Coconut Smoothie', ingredient_name: 'Ice',          qty_required: 150, unit: 'g'  },
    ],
  },
]

// ── Apply Template ─────────────────────────────────────────────────────────────

export type ApplyResult = {
  recipesCreated: number
  recipesSkipped: number
  ingredientsCreated: number
  ingredientsSkipped: number
  linksCreated: number
}

export async function applyTemplate(template: CafeTemplate): Promise<ApplyResult> {
  const result: ApplyResult = { recipesCreated: 0, recipesSkipped: 0, ingredientsCreated: 0, ingredientsSkipped: 0, linksCreated: 0 }

  // 1. Resolve shop_id for the current user — required by RLS on recipes & inventory
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) throw new Error('ไม่พบผู้ใช้ — กรุณาล็อกอินใหม่')

  const { data: su, error: suErr } = await authClient
    .from('shop_users')
    .select('shop_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (suErr) throw new Error(`ไม่สามารถดึง shop: ${suErr.message}`)
  if (!su?.shop_id) throw new Error('ไม่พบร้านค้าที่เชื่อมกับบัญชีนี้')

  const shopId = su.shop_id

  // 2. Fetch existing names to skip duplicates (scoped to this shop)
  const [{ data: existingRecipes, error: erErr }, { data: existingInventory, error: eiErr }] = await Promise.all([
    authClient.from('recipes').select('product_name').eq('shop_id', shopId),
    authClient.from('inventory').select('name').eq('shop_id', shopId),
  ])

  if (erErr) throw new Error(`ดึงรายการเมนูไม่ได้: ${erErr.message}`)
  if (eiErr) throw new Error(`ดึงรายการวัตถุดิบไม่ได้: ${eiErr.message}`)

  const recipeNames    = new Set((existingRecipes  ?? []).map((r: { product_name: string }) => r.product_name.toLowerCase()))
  const inventoryNames = new Set((existingInventory ?? []).map((i: { name: string }) => i.name.toLowerCase()))

  // 3. Insert new recipes
  const recipeInserts = template.items.filter(item => !recipeNames.has(item.product_name.toLowerCase()))
  result.recipesSkipped = template.items.length - recipeInserts.length

  const insertedRecipes: { id: string; product_name: string }[] = []
  if (recipeInserts.length > 0) {
    const { data: created, error: rErr } = await authClient.from('recipes').insert(
      recipeInserts.map(item => ({
        product_name:    item.product_name,
        product_name_th: item.product_name_th,
        product_name_lo: item.product_name_lo,
        price_lak:       item.price_lak,
        category_id:     item.category_id,
        is_active:       true,
        shop_id:         shopId,
      }))
    ).select('id, product_name')

    if (rErr) throw new Error(`สร้างเมนูไม่ได้: ${rErr.message}`)
    result.recipesCreated = (created ?? []).length
    insertedRecipes.push(...(created ?? []) as { id: string; product_name: string }[])
  }

  // 4. Insert new inventory items
  const inventoryInserts = template.ingredients.filter(ing => !inventoryNames.has(ing.name.toLowerCase()))
  result.ingredientsSkipped = template.ingredients.length - inventoryInserts.length

  const insertedInventory: { id: string; name: string }[] = []
  if (inventoryInserts.length > 0) {
    const { data: created, error: iErr } = await authClient.from('inventory').insert(
      inventoryInserts.map(ing => ({
        name:          ing.name,
        name_th:       ing.name_th,
        name_lo:       ing.name_lo,
        unit:          ing.unit,
        current_qty:   ing.current_qty,
        cost_per_unit: ing.cost_per_unit,
        is_active:     true,
        shop_id:       shopId,
      }))
    ).select('id, name')

    if (iErr) throw new Error(`สร้างวัตถุดิบไม่ได้: ${iErr.message}`)
    result.ingredientsCreated = (created ?? []).length
    insertedInventory.push(...(created ?? []) as { id: string; name: string }[])
  }

  // 5. Build recipe-ingredient links for newly created recipes
  if (insertedRecipes.length > 0) {
    const [{ data: allInventory }, { data: allRecipes }] = await Promise.all([
      authClient.from('inventory').select('id, name').eq('shop_id', shopId),
      authClient.from('recipes').select('id, product_name').eq('shop_id', shopId),
    ])

    const inventoryMap = new Map((allInventory ?? []).map((i: { id: string; name: string }) => [i.name.toLowerCase(), i.id]))
    const recipeMap    = new Map((allRecipes   ?? []).map((r: { id: string; product_name: string }) => [r.product_name.toLowerCase(), r.id]))

    const newRecipeIds = new Set(insertedRecipes.map(r => r.id))

    const newLinks = template.recipeLinks
      .filter(link => {
        const rid = recipeMap.get(link.recipe_name.toLowerCase())
        const iid = inventoryMap.get(link.ingredient_name.toLowerCase())
        return rid && iid && newRecipeIds.has(rid)
      })
      .map(link => ({
        recipe_id:    recipeMap.get(link.recipe_name.toLowerCase())!,
        inventory_id: inventoryMap.get(link.ingredient_name.toLowerCase())!,
        qty_required: link.qty_required,
        unit:         link.unit,
      }))

    if (newLinks.length > 0) {
      const { data, error: lErr } = await authClient.from('recipe_ingredients').insert(newLinks).select('id')
      if (lErr) throw new Error(`เชื่อมสูตรไม่ได้: ${lErr.message}`)
      result.linksCreated = (data ?? []).length
    }
  }

  return result
}
