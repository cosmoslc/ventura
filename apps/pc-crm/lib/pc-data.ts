export interface PcComponentItem {
  role: "cpu" | "gpu" | "ram" | "ssd" | "hdd" | "motherboard" | "psu" | "case" | "cooler" | "monitor" | "other";
  roleNameUz: string;
  productId: string;
  productName: string;
  qty: number;
  costSnapshot: bigint;
  sellPrice: bigint;
  imageUrl?: string;
  inStock?: boolean;
}

export interface PcSpecItem {
  key: string;
  title: string;
  value: string;
  filterable?: boolean;
  helpTitle?: string;
  helpText?: string;
}

export interface PcBuildItem {
  id: string;
  slug: string;
  name: string;
  images: string[];
  costPrice: bigint;
  sellPrice: bigint;
  discountPercent: number;
  status: "available" | "sold" | "hidden";
  buyerName?: string;
  buyerPhone?: string;
  soldAt?: string;
  ratingAvg: number;
  ratingCount: number;
  cpu: string;
  gpu: string;
  ram: string;
  storage: string;
  components: PcComponentItem[];
  specs: PcSpecItem[];
  description?: string;
  warrantyMonths?: number;
}

/** Public PC detail payload. Internal cost snapshots must never cross the server boundary. */
export type PcBuildPublicItem = Omit<PcBuildItem, "costPrice" | "components" | "buyerName" | "buyerPhone" | "soldAt"> & {
  components: Omit<PcComponentItem, "costSnapshot" | "sellPrice">[];
};

export interface ConfiguratorPart {
  id: string;
  role: "cpu" | "gpu" | "ram" | "ssd" | "motherboard" | "psu" | "case" | "cooler";
  roleLabel: string;
  name: string;
  brand: string;
  price: bigint;
  costPrice: bigint;
  stock: number;
  imageUrl: string;
  specsSummary: string;
  tdpWatts?: number;
}

export interface PcOrderItem {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  customerNote?: string;
  status: "new" | "reviewing" | "quoted" | "confirmed" | "assembling" | "ready" | "delivered" | "cancelled";
  quotedPrice?: bigint;
  costPrice: bigint;
  createdAt: string;
  pcName?: string;
  components: {
    role: string;
    roleNameUz: string;
    productName: string;
    price: bigint;
    costPrice?: bigint;
    inStock: boolean;
  }[];
  operatorNote?: string;
  convertedPcId?: string;
}

export const SAMPLE_PC_BUILDS: PcBuildItem[] = [
  {
    id: "pc-1",
    slug: "ventura-gaming-titan-i7-4070",
    name: "Gaming Titan",
    images: [
      "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=900&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=900&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=900&auto=format&fit=crop&q=80",
    ],
    costPrice: 21_200_000n,
    sellPrice: 26_500_000n,
    discountPercent: 6,
    status: "available",
    ratingAvg: 5.0,
    ratingCount: 14,
    cpu: "Intel Core i7-14700K",
    gpu: "NVIDIA RTX 4070 Ti Super 16GB",
    ram: "32GB Kingston FURY DDR5 6000MHz",
    storage: "1TB Samsung 990 PRO NVMe",
    warrantyMonths: 12,
    description: "Ventura Gaming Titan — 2K va 4K formatdagi eng og'ir o'yinlar, 3D modellashtirish va video montaj uchun maxsus yig'ilgan ultra quvvatli stansiya. Har bir komponent to'liq sinovdan o'tkazilgan.",
    components: [
      {
        role: "cpu",
        roleNameUz: "Protsessor",
        productId: "p-cpu-14700k",
        productName: "Intel Core i7-14700K 3.4GHz LGA1700",
        qty: 1,
        costSnapshot: 4_600_000n,
        sellPrice: 5_200_000n,
        inStock: true,
      },
      {
        role: "motherboard",
        roleNameUz: "Ona plata",
        productId: "p-mb-z790",
        productName: "MSI MAG Z790 TOMAHAWK WIFI DDR5",
        qty: 1,
        costSnapshot: 2_700_000n,
        sellPrice: 3_200_000n,
        inStock: true,
      },
      {
        role: "gpu",
        roleNameUz: "Videokarta",
        productId: "p-gpu-4070ti",
        productName: "ASUS ROG Strix GeForce RTX 4070 Ti SUPER 16GB",
        qty: 1,
        costSnapshot: 10_200_000n,
        sellPrice: 12_400_000n,
        inStock: true,
      },
      {
        role: "ram",
        roleNameUz: "Operativ xotira",
        productId: "p-ram-fury32",
        productName: "Kingston FURY Beast RGB 32GB (2x16GB) DDR5 6000MHz",
        qty: 1,
        costSnapshot: 1_400_000n,
        sellPrice: 1_750_000n,
        inStock: true,
      },
      {
        role: "ssd",
        roleNameUz: "SSD To'plovchi",
        productId: "p-ssd-990pro",
        productName: "Samsung 990 PRO 1TB PCIe 4.0 NVMe M.2",
        qty: 1,
        costSnapshot: 1_500_000n,
        sellPrice: 1_850_000n,
        inStock: true,
      },
      {
        role: "psu",
        roleNameUz: "Blok pitaniya",
        productId: "p-psu-rm850e",
        productName: "Corsair RM850e 850W 80 PLUS Gold Modulli",
        qty: 1,
        costSnapshot: 1_350_000n,
        sellPrice: 1_650_000n,
        inStock: true,
      },
      {
        role: "cooler",
        roleNameUz: "Sovutish tizimi",
        productId: "p-cl-lt720",
        productName: "DeepCool LT720 360mm Suyuqlik sovutish tizimi",
        qty: 1,
        costSnapshot: 1_100_000n,
        sellPrice: 1_450_000n,
        inStock: true,
      },
      {
        role: "case",
        roleNameUz: "Korpus",
        productId: "p-cs-h7flow",
        productName: "NZXT H7 Flow RGB Black Temperli Shisha",
        qty: 1,
        costSnapshot: 1_250_000n,
        sellPrice: 1_550_000n,
        inStock: true,
      },
    ],
    specs: [
      {
        key: "cpu_model",
        title: "Protsessor (CPU)",
        value: "Intel Core i7-14700K (20 yadro, 28 oqim, 5.6 GHz turbo)",
        filterable: true,
        helpTitle: "Protsessor yadrolari va oqimlari nima?",
        helpText: "20 yadro bir vaqtda ham og'ir o'yin o'ynash, ham fon rejimida video render qilish va strim uzatish imkonini to'liq qotishlarsiz beradi.",
      },
      {
        key: "gpu_model",
        title: "Videokarta (GPU)",
        value: "NVIDIA GeForce RTX 4070 Ti Super 16GB GDDR6X",
        filterable: true,
        helpTitle: "DLSS 3.0 va 16GB VRAM nimaga kerak?",
        helpText: "DLSS 3 kadrlar generatori sun'iy intellekt orqali FPS ko'rsatkichini 2-3 barobar oshiradi. 16GB video xotira esa 4K teksturalar uchun zaxira kafolati.",
      },
      {
        key: "ram_spec",
        title: "Tezkor xotira (RAM)",
        value: "32GB (2x16GB) DDR5 6000MHz CL30 Kingston FURY Beast RGB",
        helpTitle: "DDR5 6000MHz va Dual-channel nima?",
        helpText: "Ikki kanalli rejim xotira o'tkazuvchanligini 2 barobarga oshiradi, bu o'yinlarda 1% low FPS tushib ketishining oldini oladi.",
      },
      {
        key: "storage_spec",
        title: "Doimiy xotira (SSD)",
        value: "1TB Samsung 990 PRO NVMe M.2 (7450 MB/s o'qish)",
        helpTitle: "PCIe 4.0 NVMe SSD nima beradi?",
        helpText: "O'yinlar va Windows 11 operatsion tizimi soniyaning ulushlarida ochiladi, render va fayl ko'chirish tezligi maksimal bo'ladi.",
      },
      {
        key: "cooling_spec",
        title: "Sovutish tizimi",
        value: "DeepCool LT720 360mm AIO Liquid Cooler",
        helpTitle: "360mm Suyuqlik sovutish tizimi nima uchun kerak?",
        helpText: "Yuqori quvvatli Core i7 protsessorini hatto soatlab davom etuvchi maksimal yuklamalarda ham 70 darajadan oshirmaydi.",
      },
      {
        key: "psu_spec",
        title: "Quvvat bloki",
        value: "Corsair RM850e 850W 80 PLUS Gold Full-Modular",
        helpTitle: "80 PLUS Gold sertifikati nimani anglatadi?",
        helpText: "Elektr energiyasini kamida 90% samaradorlik bilan konvertatsiya qiladi, kam qiziydi va uzoq yillar xavfsiz ishlaydi.",
      },
    ],
  },
  {
    id: "pc-2",
    slug: "ventura-streamer-pro-ryzen7-4060ti",
    name: "Streamer Pro",
    images: [
      "https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=900&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=900&auto=format&fit=crop&q=80",
    ],
    costPrice: 15_600_000n,
    sellPrice: 18_900_000n,
    discountPercent: 0,
    status: "available",
    ratingAvg: 4.9,
    ratingCount: 18,
    cpu: "AMD Ryzen 7 7800X3D",
    gpu: "NVIDIA RTX 4060 Ti 8GB",
    ram: "32GB Corsair DDR5 6000MHz",
    storage: "1TB Kingston KC3000 Gen4",
    warrantyMonths: 12,
    description: "Dunyoning eng yaxshi o'yin protsessori AMD Ryzen 7 7800X3D (3D V-Cache) asosida yig'ilgan kompyuter. CS2, Dota 2, Valorant va Warzone strimerlari uchun ideal tanlov.",
    components: [
      {
        role: "cpu",
        roleNameUz: "Protsessor",
        productId: "p-cpu-7800x3d",
        productName: "AMD Ryzen 7 7800X3D AM5",
        qty: 1,
        costSnapshot: 4_800_000n,
        sellPrice: 5_500_000n,
        inStock: true,
      },
      {
        role: "gpu",
        roleNameUz: "Videokarta",
        productId: "p-gpu-4060ti",
        productName: "MSI GeForce RTX 4060 Ti Ventus 2X 8GB",
        qty: 1,
        costSnapshot: 4_700_000n,
        sellPrice: 5_600_000n,
        inStock: true,
      },
    ],
    specs: [
      {
        key: "cpu_model",
        title: "Protsessor (CPU)",
        value: "AMD Ryzen 7 7800X3D (8 yadro, 16 oqim, 96MB 3D V-Cache)",
        filterable: true,
        helpTitle: "3D V-Cache texnologiyasi nima?",
        helpText: "Katta kesh xotira protsessorga o'yin buyruqlarini zudlik bilan bajarish imkonini beradi va e-sport o'yinlarida eng yuqori FPS ko'rsatadi.",
      },
      {
        key: "gpu_model",
        title: "Videokarta (GPU)",
        value: "NVIDIA GeForce RTX 4060 Ti 8GB GDDR6",
        filterable: true,
      },
    ],
  },
  {
    id: "pc-3",
    slug: "ventura-cyber-beast-i9-4090",
    name: "Cyber Beast",
    images: [
      "https://images.unsplash.com/photo-1547082299-de196ea013d6?w=900&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=900&auto=format&fit=crop&q=80",
    ],
    costPrice: 42_000_000n,
    sellPrice: 51_000_000n,
    discountPercent: 5,
    status: "available",
    ratingAvg: 5.0,
    ratingCount: 7,
    cpu: "Intel Core i9-14900K",
    gpu: "NVIDIA RTX 4090 24GB",
    ram: "64GB DDR5 6400MHz G.Skill",
    storage: "2TB Samsung 990 PRO NVMe",
    warrantyMonths: 24,
    description: "Murosasiz kuch: eng yuqori pog'onadagi komponentlar, Lian Li akvarium korpusi, to'liq ARGB sinxronizatsiya va 4K Ultra o'yinlarda 120+ FPS.",
    components: [],
    specs: [
      {
        key: "cpu_model",
        title: "Protsessor (CPU)",
        value: "Intel Core i9-14900K (24 yadro, 32 oqim, 6.0 GHz)",
        filterable: true,
      },
      {
        key: "gpu_model",
        title: "Videokarta (GPU)",
        value: "ASUS ROG Matrix GeForce RTX 4090 24GB",
        filterable: true,
      },
    ],
  },
  {
    id: "pc-4",
    slug: "ventura-creator-amd-rx7800xt",
    name: "Creator Pro",
    images: [
      "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=900&auto=format&fit=crop&q=80",
    ],
    costPrice: 14_100_000n,
    sellPrice: 16_800_000n,
    discountPercent: 0,
    status: "available",
    ratingAvg: 4.8,
    ratingCount: 9,
    cpu: "AMD Ryzen 5 7600X",
    gpu: "Radeon RX 7800 XT 16GB",
    ram: "32GB Kingston DDR5 6000MHz",
    storage: "1TB M.2 NVMe SSD",
    warrantyMonths: 12,
    description: "Narx va unumdorlik bo'yicha eng maqbul muvozanat. 16GB katta video xotira 1440p o'yinlar va videoni 4K formatda eksport qilish uchun qulay.",
    components: [],
    specs: [
      {
        key: "cpu_model",
        title: "Protsessor (CPU)",
        value: "AMD Ryzen 5 7600X (6 yadro, 12 oqim, 5.3 GHz)",
        filterable: true,
      },
      {
        key: "gpu_model",
        title: "Videokarta (GPU)",
        value: "Sapphire Pure AMD Radeon RX 7800 XT 16GB",
        filterable: true,
      },
    ],
  },
  {
    id: "pc-5",
    slug: "ventura-entry-gaming-i5-4060",
    name: "Ventura Starter",
    images: [
      "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=900&auto=format&fit=crop&q=80",
    ],
    costPrice: 9_300_000n,
    sellPrice: 11_500_000n,
    discountPercent: 4,
    status: "available",
    ratingAvg: 4.7,
    ratingCount: 23,
    cpu: "Intel Core i5-14400F",
    gpu: "NVIDIA RTX 4060 8GB",
    ram: "16GB DDR5 5200MHz",
    storage: "512GB Kingston NV2 SSD",
    warrantyMonths: 12,
    description: "Zamonaviy o'yinlar va dasturlash uchun qulay va byudjetli kirish stansiyasi. 1080p Full HD formatida barcha o'yinlarni yuqori sifatda o'ynash imkoni.",
    components: [],
    specs: [
      {
        key: "cpu_model",
        title: "Protsessor (CPU)",
        value: "Intel Core i5-14400F (10 yadro, 16 oqim)",
        filterable: true,
      },
      {
        key: "gpu_model",
        title: "Videokarta (GPU)",
        value: "Palit GeForce RTX 4060 Dual 8GB",
        filterable: true,
      },
    ],
  },
  {
    id: "pc-6",
    slug: "ventura-pro-workstation-threadripper",
    name: "Pro Render",
    images: [
      "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=900&auto=format&fit=crop&q=80",
    ],
    costPrice: 28_400_000n,
    sellPrice: 34_000_000n,
    discountPercent: 0,
    status: "sold",
    ratingAvg: 5.0,
    ratingCount: 3,
    cpu: "AMD Ryzen 9 7950X",
    gpu: "NVIDIA RTX 4080 Super 16GB",
    ram: "64GB DDR5 6000MHz",
    storage: "2TB Kingston KC3000",
    warrantyMonths: 24,
    description: "Arxitektura, SAPR, Blender va Unreal Engine 5 loyihalarini professional render qilish uchun yig'ilgan ishchi stansiya. (Sotilgan)",
    components: [],
    specs: [
      {
        key: "cpu_model",
        title: "Protsessor (CPU)",
        value: "AMD Ryzen 9 7950X (16 yadro, 32 oqim)",
        filterable: true,
      },
      {
        key: "gpu_model",
        title: "Videokarta (GPU)",
        value: "GIGABYTE GeForce RTX 4080 SUPER Gaming OC 16GB",
        filterable: true,
      },
    ],
  },
];

// Konfigurator qismlari katalogi
export const CONFIGURATOR_CATALOG: ConfiguratorPart[] = [
  // CPU
  {
    id: "cfg-cpu-1",
    role: "cpu",
    roleLabel: "Protsessor (CPU)",
    name: "Intel Core i5-14400F (10 yadro, 4.7 GHz)",
    brand: "Intel",
    price: 2_450_000n,
    costPrice: 2_100_000n,
    stock: 12,
    imageUrl: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=300&auto=format&fit=crop&q=80",
    specsSummary: "LGA1700, 6P+4E yadro, 65W TDP, Intel 7",
    tdpWatts: 65,
  },
  {
    id: "cfg-cpu-2",
    role: "cpu",
    roleLabel: "Protsessor (CPU)",
    name: "Intel Core i7-14700K (20 yadro, 5.6 GHz)",
    brand: "Intel",
    price: 5_200_000n,
    costPrice: 4_600_000n,
    stock: 8,
    imageUrl: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=300&auto=format&fit=crop&q=80",
    specsSummary: "LGA1700, 8P+12E yadro, UHD 770, 125W TDP",
    tdpWatts: 125,
  },
  {
    id: "cfg-cpu-3",
    role: "cpu",
    roleLabel: "Protsessor (CPU)",
    name: "AMD Ryzen 7 7800X3D (8 yadro, 3D V-Cache)",
    brand: "AMD",
    price: 5_500_000n,
    costPrice: 4_800_000n,
    stock: 6,
    imageUrl: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=300&auto=format&fit=crop&q=80",
    specsSummary: "Socket AM5, 96MB L3 kesh, 120W TDP",
    tdpWatts: 120,
  },
  {
    id: "cfg-cpu-4",
    role: "cpu",
    roleLabel: "Protsessor (CPU)",
    name: "Intel Core i9-14900K (24 yadro, 6.0 GHz)",
    brand: "Intel",
    price: 7_800_000n,
    costPrice: 6_900_000n,
    stock: 4,
    imageUrl: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=300&auto=format&fit=crop&q=80",
    specsSummary: "LGA1700, 8P+16E yadro, 253W Max Turbo",
    tdpWatts: 253,
  },

  // Motherboard
  {
    id: "cfg-mb-1",
    role: "motherboard",
    roleLabel: "Ona plata (Motherboard)",
    name: "MSI B760 GAMING PLUS WIFI DDR5",
    brand: "MSI",
    price: 2_150_000n,
    costPrice: 1_850_000n,
    stock: 14,
    imageUrl: "https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=300&auto=format&fit=crop&q=80",
    specsSummary: "LGA1700, 4x DDR5, PCIe 4.0, Wi-Fi 6E, ATX",
  },
  {
    id: "cfg-mb-2",
    role: "motherboard",
    roleLabel: "Ona plata (Motherboard)",
    name: "MSI MAG Z790 TOMAHAWK WIFI",
    brand: "MSI",
    price: 3_400_000n,
    costPrice: 2_950_000n,
    stock: 7,
    imageUrl: "https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=300&auto=format&fit=crop&q=80",
    specsSummary: "LGA1700, 16+1+1 Fazali VRM, 4x M.2 PCIe 4.0, Wi-Fi 6E",
  },
  {
    id: "cfg-mb-3",
    role: "motherboard",
    roleLabel: "Ona plata (Motherboard)",
    name: "ASUS ROG STRIX B650E-F GAMING WIFI",
    brand: "ASUS",
    price: 3_800_000n,
    costPrice: 3_250_000n,
    stock: 5,
    imageUrl: "https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=300&auto=format&fit=crop&q=80",
    specsSummary: "AM5, PCIe 5.0 x16, DDR5 6400+ OC, Wi-Fi 6E",
  },

  // GPU
  {
    id: "cfg-gpu-1",
    role: "gpu",
    roleLabel: "Videokarta (GPU)",
    name: "Palit GeForce RTX 4060 Dual 8GB GDDR6",
    brand: "Palit",
    price: 4_350_000n,
    costPrice: 3_800_000n,
    stock: 10,
    imageUrl: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=300&auto=format&fit=crop&q=80",
    specsSummary: "DLSS 3, Ray Tracing, 115W, 3072 CUDA",
    tdpWatts: 115,
  },
  {
    id: "cfg-gpu-2",
    role: "gpu",
    roleLabel: "Videokarta (GPU)",
    name: "ASUS Dual GeForce RTX 4070 SUPER 12GB",
    brand: "ASUS",
    price: 8_900_000n,
    costPrice: 7_750_000n,
    stock: 7,
    imageUrl: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=300&auto=format&fit=crop&q=80",
    specsSummary: "12GB GDDR6X, 7168 CUDA, 220W, DLSS 3",
    tdpWatts: 220,
  },
  {
    id: "cfg-gpu-3",
    role: "gpu",
    roleLabel: "Videokarta (GPU)",
    name: "ASUS ROG Strix RTX 4070 Ti SUPER 16GB",
    brand: "ASUS",
    price: 12_400_000n,
    costPrice: 10_200_000n,
    stock: 4,
    imageUrl: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=300&auto=format&fit=crop&q=80",
    specsSummary: "16GB GDDR6X 256-bit, 285W, 8448 CUDA",
    tdpWatts: 285,
  },
  {
    id: "cfg-gpu-4",
    role: "gpu",
    roleLabel: "Videokarta (GPU)",
    name: "MSI GeForce RTX 4090 SUPRIM X 24GB",
    brand: "MSI",
    price: 26_500_000n,
    costPrice: 22_500_000n,
    stock: 2,
    imageUrl: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=300&auto=format&fit=crop&q=80",
    specsSummary: "24GB GDDR6X 384-bit, 450W, 16384 CUDA",
    tdpWatts: 450,
  },

  // RAM
  {
    id: "cfg-ram-1",
    role: "ram",
    roleLabel: "Operativ xotira (RAM)",
    name: "Kingston FURY Beast 16GB (2x8GB) DDR5 5200MHz",
    brand: "Kingston",
    price: 950_000n,
    costPrice: 780_000n,
    stock: 20,
    imageUrl: "https://images.unsplash.com/photo-1541029071515-84cc54f84dc5?w=300&auto=format&fit=crop&q=80",
    specsSummary: "DDR5-5200, CL40, Intel XMP 3.0",
  },
  {
    id: "cfg-ram-2",
    role: "ram",
    roleLabel: "Operativ xotira (RAM)",
    name: "Kingston FURY Beast RGB 32GB (2x16GB) 6000MHz",
    brand: "Kingston",
    price: 1_750_000n,
    costPrice: 1_400_000n,
    stock: 15,
    imageUrl: "https://images.unsplash.com/photo-1541029071515-84cc54f84dc5?w=300&auto=format&fit=crop&q=80",
    specsSummary: "DDR5-6000, CL36, ARGB, XMP 3.0 & EXPO",
  },
  {
    id: "cfg-ram-3",
    role: "ram",
    roleLabel: "Operativ xotira (RAM)",
    name: "Corsair Vengeance RGB 64GB (2x32GB) DDR5 6000MHz",
    brand: "Corsair",
    price: 3_200_000n,
    costPrice: 2_600_000n,
    stock: 8,
    imageUrl: "https://images.unsplash.com/photo-1541029071515-84cc54f84dc5?w=300&auto=format&fit=crop&q=80",
    specsSummary: "DDR5-6000, CL30, Qora radiator, iCUE ARGB",
  },

  // SSD
  {
    id: "cfg-ssd-1",
    role: "ssd",
    roleLabel: "Doimiy xotira (SSD)",
    name: "Kingston NV2 1TB PCIe 4.0 NVMe M.2",
    brand: "Kingston",
    price: 880_000n,
    costPrice: 720_000n,
    stock: 22,
    imageUrl: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=300&auto=format&fit=crop&q=80",
    specsSummary: "O'qish: 3500 MB/s, Yozish: 2100 MB/s",
  },
  {
    id: "cfg-ssd-2",
    role: "ssd",
    roleLabel: "Doimiy xotira (SSD)",
    name: "Samsung 990 PRO 1TB PCIe 4.0 NVMe M.2",
    brand: "Samsung",
    price: 1_850_000n,
    costPrice: 1_500_000n,
    stock: 14,
    imageUrl: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=300&auto=format&fit=crop&q=80",
    specsSummary: "O'qish: 7450 MB/s, Yozish: 6900 MB/s, V-NAND 3-bit MLC",
  },
  {
    id: "cfg-ssd-3",
    role: "ssd",
    roleLabel: "Doimiy xotira (SSD)",
    name: "Samsung 990 PRO 2TB PCIe 4.0 NVMe M.2",
    brand: "Samsung",
    price: 2_950_000n,
    costPrice: 2_450_000n,
    stock: 9,
    imageUrl: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=300&auto=format&fit=crop&q=80",
    specsSummary: "O'qish: 7450 MB/s, 2GB LPDDR4 DRAM kesh",
  },

  // PSU
  {
    id: "cfg-psu-1",
    role: "psu",
    roleLabel: "Quvvat bloki (PSU)",
    name: "DeepCool PK650D 650W 80 PLUS Bronze",
    brand: "DeepCool",
    price: 750_000n,
    costPrice: 600_000n,
    stock: 16,
    imageUrl: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=300&auto=format&fit=crop&q=80",
    specsSummary: "650W, 80 PLUS Bronze, 120mm tinch ventilyator",
  },
  {
    id: "cfg-psu-2",
    role: "psu",
    roleLabel: "Quvvat bloki (PSU)",
    name: "Corsair RM850e 850W 80 PLUS Gold Modulli",
    brand: "Corsair",
    price: 1_650_000n,
    costPrice: 1_350_000n,
    stock: 11,
    imageUrl: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=300&auto=format&fit=crop&q=80",
    specsSummary: "850W, ATX 3.0 & PCIe 5.0 (12VHPWR), Zero RPM",
  },
  {
    id: "cfg-psu-3",
    role: "psu",
    roleLabel: "Quvvat bloki (PSU)",
    name: "Seasonic Focus GX-1000 1000W 80 PLUS Gold",
    brand: "Seasonic",
    price: 2_600_000n,
    costPrice: 2_150_000n,
    stock: 5,
    imageUrl: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=300&auto=format&fit=crop&q=80",
    specsSummary: "1000W, Yapon kondensatorlari, 10 yil kafolat",
  },

  // Cooler
  {
    id: "cfg-clr-1",
    role: "cooler",
    roleLabel: "Sovutish tizimi (Cooler)",
    name: "DeepCool AG400 ARGB Havo sovutgichi",
    brand: "DeepCool",
    price: 340_000n,
    costPrice: 270_000n,
    stock: 25,
    imageUrl: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=300&auto=format&fit=crop&q=80",
    specsSummary: "4 issiqlik trubkasi, 220W TDP quvvat, 120mm PWM",
  },
  {
    id: "cfg-clr-2",
    role: "cooler",
    roleLabel: "Sovutish tizimi (Cooler)",
    name: "Thermalright Peerless Assassin 120 SE ARGB",
    brand: "Thermalright",
    price: 590_000n,
    costPrice: 470_000n,
    stock: 18,
    imageUrl: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=300&auto=format&fit=crop&q=80",
    specsSummary: "Ikki minorali, 6 issiqlik trubkasi, 2x 120mm PWM",
  },
  {
    id: "cfg-clr-3",
    role: "cooler",
    roleLabel: "Sovutish tizimi (Cooler)",
    name: "DeepCool LT720 360mm Suyuqlik sovutgichi",
    brand: "DeepCool",
    price: 1_450_000n,
    costPrice: 1_100_000n,
    stock: 10,
    imageUrl: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=300&auto=format&fit=crop&q=80",
    specsSummary: "360mm radiator, 300W+ sovutish, 4-avlod pompa",
  },

  // Case
  {
    id: "cfg-cs-1",
    role: "case",
    roleLabel: "Korpus (Case)",
    name: "Montech AIR 903 MAX Black (4x 140mm Fan)",
    brand: "Montech",
    price: 980_000n,
    costPrice: 790_000n,
    stock: 12,
    imageUrl: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=300&auto=format&fit=crop&q=80",
    specsSummary: "Mesh old panel, 4x 140mm ARGB fan, Shisha eshik",
  },
  {
    id: "cfg-cs-2",
    role: "case",
    roleLabel: "Korpus (Case)",
    name: "NZXT H7 Flow RGB Black",
    brand: "NZXT",
    price: 1_550_000n,
    costPrice: 1_250_000n,
    stock: 8,
    imageUrl: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=300&auto=format&fit=crop&q=80",
    specsSummary: "Type-C port, perforatsiyalangan yuqori/old panel",
  },
  {
    id: "cfg-cs-3",
    role: "case",
    roleLabel: "Korpus (Case)",
    name: "Lian Li O11 Dynamic EVO Black (Akvarium)",
    brand: "Lian Li",
    price: 2_100_000n,
    costPrice: 1_700_000n,
    stock: 5,
    imageUrl: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=300&auto=format&fit=crop&q=80",
    specsSummary: "Ikki kamerali, panoroma temperli shisha, 360mm radiator",
  },
];

export const SAMPLE_PC_ORDERS: PcOrderItem[] = [
  {
    id: "pco-101",
    orderNumber: "PCO-2026-089",
    customerName: "Sardorbek Rahimov",
    customerPhone: "+998 90 123 45 67",
    deliveryAddress: "Toshkent sh., Chilonzor tumani, 9-mavze, 14-uy",
    customerNote: "Operativ xotira RGB bo'lsin, montaj uchun qulay va sovutish yaxshi bo'lsin.",
    status: "new",
    quotedPrice: 18_500_000n,
    costPrice: 15_200_000n,
    createdAt: "2026-10-29T14:30:00Z",
    components: [
      { role: "cpu", roleNameUz: "Protsessor", productName: "Intel Core i7-14700K", price: 5_200_000n, inStock: true },
      { role: "motherboard", roleNameUz: "Ona plata", productName: "MSI MAG Z790 TOMAHAWK WIFI", price: 3_400_000n, inStock: true },
      { role: "gpu", roleNameUz: "Videokarta", productName: "ASUS Dual GeForce RTX 4070 SUPER 12GB", price: 8_900_000n, inStock: true },
      { role: "ram", roleNameUz: "RAM", productName: "Kingston FURY Beast RGB 32GB DDR5", price: 1_750_000n, inStock: true },
      { role: "ssd", roleNameUz: "SSD", productName: "Samsung 990 PRO 1TB PCIe 4.0 NVMe", price: 1_850_000n, inStock: true },
      { role: "psu", roleNameUz: "PSU", productName: "Corsair RM850e 850W Gold Modulli", price: 1_650_000n, inStock: true },
      { role: "cooler", roleNameUz: "Cooler", productName: "DeepCool LT720 360mm AIO", price: 1_450_000n, inStock: true },
      { role: "case", roleNameUz: "Korpus", productName: "NZXT H7 Flow RGB Black", price: 1_550_000n, inStock: true },
    ],
    operatorNote: "Mijoz bilan bog'lanish kerak, korpus rangi oq yoki qora bo'yicha so'ralgan.",
  },
  {
    id: "pco-102",
    orderNumber: "PCO-2026-088",
    customerName: "Azizbek Yusupov",
    customerPhone: "+998 97 765 43 21",
    deliveryAddress: "Samarqand sh., Registon ko'chasi 24",
    customerNote: "CS2 va Valorantda 400+ FPS kerak.",
    status: "confirmed",
    quotedPrice: 16_200_000n,
    costPrice: 13_500_000n,
    createdAt: "2026-10-28T18:15:00Z",
    components: [
      { role: "cpu", roleNameUz: "Protsessor", productName: "AMD Ryzen 7 7800X3D", price: 5_500_000n, inStock: true },
      { role: "motherboard", roleNameUz: "Ona plata", productName: "ASUS ROG STRIX B650E-F", price: 3_800_000n, inStock: true },
      { role: "gpu", roleNameUz: "Videokarta", productName: "Palit GeForce RTX 4060 Dual 8GB", price: 4_350_000n, inStock: true },
      { role: "ram", roleNameUz: "RAM", productName: "Kingston FURY Beast 32GB DDR5", price: 1_750_000n, inStock: true },
      { role: "ssd", roleNameUz: "SSD", productName: "Kingston NV2 1TB NVMe", price: 880_000n, inStock: true },
      { role: "psu", roleNameUz: "PSU", productName: "DeepCool PK650D 650W Bronze", price: 750_000n, inStock: true },
      { role: "cooler", roleNameUz: "Cooler", productName: "Thermalright Peerless Assassin 120", price: 590_000n, inStock: true },
      { role: "case", roleNameUz: "Korpus", productName: "Montech AIR 903 MAX Black", price: 980_000n, inStock: true },
    ],
    operatorNote: "Oldindan 30% zaklad olindi. Yig'ish sexiga uzatildi.",
  },
  {
    id: "pco-103",
    orderNumber: "PCO-2026-085",
    customerName: "Doston Qodirov",
    customerPhone: "+998 93 333 44 55",
    deliveryAddress: "Toshkent sh., Yunusobod 11",
    customerNote: "Maksimal konfiguratsiya 4K o'yinlar uchun.",
    status: "ready",
    quotedPrice: 48_000_000n,
    costPrice: 40_200_000n,
    createdAt: "2026-10-27T10:00:00Z",
    components: [
      { role: "cpu", roleNameUz: "Protsessor", productName: "Intel Core i9-14900K", price: 7_800_000n, inStock: true },
      { role: "motherboard", roleNameUz: "Ona plata", productName: "MSI MAG Z790 TOMAHAWK WIFI", price: 3_400_000n, inStock: true },
      { role: "gpu", roleNameUz: "Videokarta", productName: "MSI GeForce RTX 4090 SUPRIM X 24GB", price: 26_500_000n, inStock: true },
      { role: "ram", roleNameUz: "RAM", productName: "Corsair Vengeance RGB 64GB DDR5", price: 3_200_000n, inStock: true },
      { role: "ssd", roleNameUz: "SSD", productName: "Samsung 990 PRO 2TB PCIe 4.0 NVMe", price: 2_950_000n, inStock: true },
      { role: "psu", roleNameUz: "PSU", productName: "Seasonic Focus GX-1000 1000W Gold", price: 2_600_000n, inStock: true },
      { role: "cooler", roleNameUz: "Cooler", productName: "DeepCool LT720 360mm AIO", price: 1_450_000n, inStock: true },
      { role: "case", roleNameUz: "Korpus", productName: "Lian Li O11 Dynamic EVO Black", price: 2_100_000n, inStock: true },
    ],
    operatorNote: "Stress testdan 100% o'tdi. Kuryer yetkazishga tayyor.",
  },
];
