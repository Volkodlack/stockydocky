/**
 * Seed idempotent — peut être relancé sans dupliquer de données (upsert).
 * Crée le compte administrateur, des utilisateurs de démonstration,
 * les référentiels (zones, catégories, fournisseurs, clients) et
 * quelques articles d'exemple sur le thème d'un magasin d'optique.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@carles.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';

async function main() {
  console.log('🌱 Initialisation des données…');

  // ───────────────────────── Utilisateurs ─────────────────────────
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: 'ADMIN', active: true },
    create: {
      email: ADMIN_EMAIL,
      password: adminHash,
      name: 'Administrateur',
      role: 'ADMIN',
    },
  });

  const employeeHash = await bcrypt.hash('Employe123!', 10);
  await prisma.user.upsert({
    where: { email: 'employe@carles.local' },
    update: {},
    create: {
      email: 'employe@carles.local',
      password: employeeHash,
      name: 'Employé Démo',
      role: 'EMPLOYEE',
    },
  });

  const inventoryHash = await bcrypt.hash('Invent123!', 10);
  await prisma.user.upsert({
    where: { email: 'inventaire@carles.local' },
    update: {},
    create: {
      email: 'inventaire@carles.local',
      password: inventoryHash,
      name: 'Agent Inventaire',
      role: 'INVENTORY',
    },
  });

  // ───────────────────────────── Zones ────────────────────────────
  const zones = [
    { code: 'A1-01', name: 'Rayon A1 - Étagère 1' },
    { code: 'A1-02', name: 'Rayon A1 - Étagère 2' },
    { code: 'B2-01', name: 'Rayon B2 - Étagère 1' },
    { code: 'VITRINE', name: 'Vitrine magasin' },
    { code: 'ATELIER', name: 'Atelier' },
    { code: 'RESERVE', name: 'Réserve' },
  ];
  const zoneByCode: Record<string, string> = {};
  for (const z of zones) {
    const zone = await prisma.zone.upsert({
      where: { code: z.code },
      update: { name: z.name },
      create: z,
    });
    zoneByCode[z.code] = zone.id;
  }

  // ─────────────────────────── Catégories ─────────────────────────
  const categories = [
    { name: 'Lunettes de vue', description: 'Montures optiques' },
    { name: 'Lunettes solaires', description: 'Montures solaires' },
    { name: 'Lentilles', description: 'Lentilles de contact' },
    { name: 'Accessoires', description: 'Étuis, cordons, produits d\'entretien' },
  ];
  const catByName: Record<string, string> = {};
  for (const c of categories) {
    const cat = await prisma.category.upsert({
      where: { name: c.name },
      update: { description: c.description },
      create: c,
    });
    catByName[c.name] = cat.id;
  }

  // ─────────────────────────── Fournisseurs ───────────────────────
  // Pas de contrainte unique sur le nom : on évite les doublons manuellement.
  const suppliers = [
    { name: 'Luxottica France', email: 'contact@luxottica.fr', phone: '01 40 00 00 00' },
    { name: 'EssilorLuxottica', email: 'pro@essilor.fr', phone: '01 49 00 00 00' },
  ];
  for (const s of suppliers) {
    const existing = await prisma.supplier.findFirst({ where: { name: s.name } });
    if (!existing) await prisma.supplier.create({ data: s });
  }

  // ───────────────────────────── Clients ──────────────────────────
  const clients = [
    { name: 'Cabinet Ophtalmologie du Centre', email: 'secretariat@cabinet-centre.fr', address: '12 rue de la Santé, 59300 Valenciennes' },
    { name: 'Client Comptoir', address: 'Vente au comptoir' },
  ];
  for (const c of clients) {
    const existing = await prisma.client.findFirst({ where: { name: c.name } });
    if (!existing) await prisma.client.create({ data: c });
  }

  // ───────────────────────────── Articles ─────────────────────────
  const articles = [
    {
      reference: 'RB-RX5228', barcode: '8053672000000', brand: 'Ray-Ban', name: 'RX5228',
      description: 'Monture optique mixte', purchasePrice: 55, salePrice: 149,
      stock: 12, minStock: 3, zone: 'A1-01', category: 'Lunettes de vue',
    },
    {
      reference: 'RB-RB2140', barcode: '8053672000017', brand: 'Ray-Ban', name: 'Wayfarer RB2140',
      description: 'Lunettes solaires iconiques', purchasePrice: 70, salePrice: 159,
      stock: 8, minStock: 2, zone: 'VITRINE', category: 'Lunettes solaires',
    },
    {
      reference: 'OAK-OX8156', barcode: '8888888000024', brand: 'Oakley', name: 'OX8156 Holbrook',
      description: 'Monture sport', purchasePrice: 60, salePrice: 139,
      stock: 5, minStock: 2, zone: 'A1-02', category: 'Lunettes de vue',
    },
    {
      reference: 'ACU-OASYS', barcode: '7777777000031', brand: 'Acuvue', name: 'Oasys (boîte de 6)',
      description: 'Lentilles bimensuelles', purchasePrice: 18, salePrice: 39,
      stock: 30, minStock: 10, zone: 'B2-01', category: 'Lentilles',
    },
    {
      reference: 'ACC-ETUI-01', barcode: '6666666000048', brand: 'Generic', name: 'Étui rigide noir',
      description: 'Étui de protection', purchasePrice: 2, salePrice: 9,
      stock: 50, minStock: 15, zone: 'A1-02', category: 'Accessoires',
    },
    {
      reference: 'ACC-SPRAY-01', barcode: '6666666000055', brand: 'Generic', name: 'Spray nettoyant 30ml',
      description: 'Nettoyant verres', purchasePrice: 1, salePrice: 5,
      stock: 2, minStock: 8, zone: 'VITRINE', category: 'Accessoires',
    },
  ];

  for (const a of articles) {
    await prisma.article.upsert({
      where: { reference: a.reference },
      update: {
        barcode: a.barcode,
        brand: a.brand,
        name: a.name,
        description: a.description,
        purchasePrice: a.purchasePrice,
        salePrice: a.salePrice,
        minStock: a.minStock,
        zoneId: zoneByCode[a.zone],
        categoryId: catByName[a.category],
      },
      create: {
        reference: a.reference,
        barcode: a.barcode,
        brand: a.brand,
        name: a.name,
        description: a.description,
        purchasePrice: a.purchasePrice,
        salePrice: a.salePrice,
        stock: a.stock,
        minStock: a.minStock,
        zoneId: zoneByCode[a.zone],
        categoryId: catByName[a.category],
      },
    });
  }

  console.log('✅ Données prêtes.');
  console.log(`   Admin     : ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log('   Employé   : employe@carles.local / Employe123!');
  console.log('   Inventaire: inventaire@carles.local / Invent123!');
}

main()
  .catch((e) => {
    console.error('❌ Erreur de seed :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
