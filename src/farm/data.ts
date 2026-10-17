/** بيانات Pocket Farm Tycoon الثابتة. الأسعار والأزمنة قابلة للقراءة من الواجهة. */

export const CROPS = {
  cucumber: { name: 'خيار', seedPrice: 2, growSeconds: 20, water: 6, yield: 3, basePrice: 5, level: 1, color: '#66bb52' },
  garlic: { name: 'ثوم', seedPrice: 3, growSeconds: 25, water: 7, yield: 2, basePrice: 10, level: 1, color: '#eee7c7' },
  tomato: { name: 'طماطم', seedPrice: 5, growSeconds: 42, water: 9, yield: 3, basePrice: 14, level: 2, color: '#e8564f' },
  lettuce: { name: 'خس', seedPrice: 4, growSeconds: 34, water: 8, yield: 3, basePrice: 11, level: 2, color: '#79bd55' },
  potato: { name: 'بطاطس', seedPrice: 5, growSeconds: 55, water: 11, yield: 3, basePrice: 16, level: 3, color: '#c9a66b' },
  carrot: { name: 'جزر', seedPrice: 6, growSeconds: 62, water: 12, yield: 3, basePrice: 19, level: 4, color: '#ef8a3b' },
  onion: { name: 'بصل', seedPrice: 7, growSeconds: 68, water: 12, yield: 3, basePrice: 22, level: 5, color: '#d6b4d8' },
  pepper: { name: 'فلفل', seedPrice: 9, growSeconds: 76, water: 14, yield: 3, basePrice: 28, level: 6, color: '#d84d42' },
  strawberry: { name: 'فراولة', seedPrice: 11, growSeconds: 85, water: 15, yield: 3, basePrice: 34, level: 7, color: '#e83e62' },
  corn: { name: 'ذرة', seedPrice: 13, growSeconds: 95, water: 17, yield: 4, basePrice: 38, level: 8, color: '#e5c64e' },
} as const;

export type CropId = keyof typeof CROPS;

export const PRODUCTS = {
  pickle: { name: 'مخلل', basePrice: 28, color: '#819f38' },
  sauce: { name: 'صلصة', basePrice: 47, color: '#c74337' },
  jam: { name: 'مربى', basePrice: 68, color: '#b53961' },
  chips: { name: 'رقائق', basePrice: 51, color: '#d9a942' },
  cornmeal: { name: 'دقيق ذرة', basePrice: 59, color: '#f1d36b' },
} as const;

export type ProductId = keyof typeof PRODUCTS;

/** أسعار المواد المشتركة بين العرض والمحرك. */
export const MATERIAL_PRICES = { boxes: 3, fertilizer: 8 } as const;

export const RECIPES = {
  pickle: { name: 'مخلل الخيار', crop: 'cucumber', input: 4, output: 1, seconds: 18, cost: 3, boxes: 1, level: 2 },
  sauce: { name: 'صلصة الطماطم', crop: 'tomato', input: 4, output: 1, seconds: 24, cost: 5, boxes: 1, level: 3 },
  jam: { name: 'مربى الفراولة', crop: 'strawberry', input: 3, output: 1, seconds: 30, cost: 8, boxes: 1, level: 7 },
  chips: { name: 'رقائق البطاطس', crop: 'potato', input: 4, output: 1, seconds: 26, cost: 6, boxes: 1, level: 4 },
  cornmeal: { name: 'دقيق الذرة', crop: 'corn', input: 4, output: 1, seconds: 28, cost: 7, boxes: 1, level: 8 },
} as const satisfies Record<ProductId, {
  name: string;
  crop: CropId;
  input: number;
  output: number;
  seconds: number;
  cost: number;
  boxes: number;
  level: number;
}>;

export const UPGRADES = {
  land: { name: 'توسعة الأرض', description: 'تضيف 4 قطع لتبقى الحقول بعرض 4.', baseCost: 70, level: 1, max: 9 },
  storage: { name: 'المخزن', description: 'يزيد السعة بمقدار 60 وحدة.', baseCost: 85, level: 1, max: 6 },
  irrigation: { name: 'الري الذكي', description: 'يخفض استهلاك الماء 15% في كل مستوى.', baseCost: 110, level: 2, max: 4 },
  tools: { name: 'أدوات الحصاد', description: 'تزيد المحصول 5% في كل مستوى.', baseCost: 135, level: 2, max: 4 },
  greenhouse: { name: 'الدفيئة', description: 'تقلص زمن النمو المزروع حديثاً 8% في كل مستوى.', baseCost: 180, level: 3, max: 3 },
  factory: { name: 'المصنع', description: 'يفتح التصنيع ويقلص زمن الدفعات؛ كل مستوى يتيح خطين متوازيين (حتى 2 × المستوى).', baseCost: 260, level: 4, max: 2 },
  shop: { name: 'المتجر', description: 'يفتح بيعاً يدوياً بسعر أفضل للعلامة الموثوقة.', baseCost: 320, level: 5, max: 3 },
  vehicle: { name: 'سيارة التوصيل', description: 'تتيح شحن عقود حتى 60 وحدة.', baseCost: 360, level: 5, max: 1 },
  truck: { name: 'شاحنة التبريد', description: 'ترفع شحن العقود إلى 200 وحدة وتسرعها.', baseCost: 650, level: 7, max: 1 },
  packaging: { name: 'التغليف', description: 'شرط البيع المميز في المتجر.', baseCost: 280, level: 5, max: 2 },
} as const;

export type UpgradeId = keyof typeof UPGRADES;

export const WORKERS = {
  planter: { name: 'زارع', description: 'يزرع البذور المتاحة في القطع الفارغة.', cost: 125, wage: 2, level: 2 },
  waterer: { name: 'سقّاء', description: 'يسقي القطع المزروعة عند توفر الماء.', cost: 145, wage: 2, level: 2 },
  harvester: { name: 'حصّاد', description: 'يحصد المحاصيل الناضجة عند وجود مساحة.', cost: 190, wage: 3, level: 3 },
  warehouse: { name: 'أمين مخزن', description: 'يضيف 30 وحدة إلى سعة المخزن.', cost: 240, wage: 3, level: 4 },
  factory: { name: 'عامل مصنع', description: 'يشغّل وصفة متاحة كل دورة عمل.', cost: 330, wage: 4, level: 5 },
  driver: { name: 'سائق', description: 'مطلوب لإرسال شحنات العقود.', cost: 380, wage: 4, level: 6 },
  manager: { name: 'مدير', description: 'يخفض أجور فريق العمل 15%.', cost: 520, wage: 5, level: 7 },
} as const;

export type WorkerId = keyof typeof WORKERS;
export type ItemId = CropId | ProductId;

/** land/hired/reputation تقاس من الحالة الحالية ولا تحتاج عدادات إحصاءات جديدة. */
export type QuestMetric = 'revenue' | 'expenses' | 'planted' | 'harvested' | 'sold' | 'contracts' | 'crafted' | 'earned' | 'watered' | 'workerWages' | 'land' | 'hired' | 'reputation';

export interface QuestDefinition {
  id: string;
  name: string;
  description: string;
  metric: QuestMetric;
  target: number;
  reward: number;
  xp: number;
  period?: 'daily' | 'weekly';
}

/** الإنجازات بلا period دائمة وتُطالب مرة واحدة؛ الدورية تحتفظ بمفتاح زمني منفصل. */
export const QUESTS: QuestDefinition[] = [
  { id: 'daily-plant', name: 'بداية خضراء', description: 'ازرع 3 بذور اليوم.', metric: 'planted', target: 3, reward: 20, xp: 14, period: 'daily' },
  { id: 'daily-harvest', name: 'حصاد اليوم', description: 'احصد 5 محاصيل اليوم.', metric: 'harvested', target: 5, reward: 28, xp: 18, period: 'daily' },
  { id: 'weekly-sales', name: 'سوق الأسبوع', description: 'حقق مبيعات بقيمة 180 هذا الأسبوع.', metric: 'revenue', target: 180, reward: 75, xp: 48, period: 'weekly' },
  { id: 'weekly-factory', name: 'خط إنتاج', description: 'أكمل 3 منتجات هذا الأسبوع.', metric: 'crafted', target: 3, reward: 85, xp: 55, period: 'weekly' },
  { id: 'first-harvest', name: 'أول حصاد', description: 'احصد 3 محاصيل إجمالاً.', metric: 'harvested', target: 3, reward: 35, xp: 20 },
  { id: 'first-sale', name: 'أول مبيعات', description: 'حقق إيراد مبيعات بقيمة 100.', metric: 'revenue', target: 100, reward: 40, xp: 24 },
  { id: 'first-contract', name: 'وفاء بالعقد', description: 'أكمل عقداً واحداً.', metric: 'contracts', target: 1, reward: 65, xp: 36 },
  { id: 'first-pickle', name: 'أول مخلل', description: 'صنّع منتجاً واحداً.', metric: 'crafted', target: 1, reward: 45, xp: 28 },
  { id: 'green-empire', name: 'إمبراطورية خضراء', description: 'حقق إيراداً إجمالياً بقيمة 5000.', metric: 'revenue', target: 5000, reward: 500, xp: 300 },
  { id: 'first-land', name: 'أرض أوسع', description: 'وسّع أرض المزرعة مرة واحدة.', metric: 'land', target: 1, reward: 55, xp: 30 },
  { id: 'first-hire', name: 'فريق المزرعة', description: 'وظّف عاملاً واحداً.', metric: 'hired', target: 1, reward: 55, xp: 30 },
  { id: 'trusted-grower', name: 'مزارع موثوق', description: 'بلغ سمعة 25.', metric: 'reputation', target: 25, reward: 90, xp: 50 },
];
