import { PrismaClient, MovementType, Role, SourceType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type SeedMovement = {
  type: MovementType;
  quantity: number;
  sourceType: SourceType;
  usageReason?: string | null;
  note?: string | null;
  createdAt: Date;
};

async function applyMovement(articleId: string, locationId: string, movement: SeedMovement, createdByUserId?: string) {
  await prisma.stockMovement.create({
    data: {
      articleId,
      locationId,
      type: movement.type,
      quantity: movement.quantity,
      sourceType: movement.sourceType,
      usageReason: movement.usageReason ?? null,
      note: movement.note ?? null,
      createdAt: movement.createdAt,
      createdByUserId
    }
  });

  const delta = movement.type === MovementType.TAKE ? -movement.quantity : movement.quantity;
  const current = await prisma.inventoryBalance.findUnique({
    where: { articleId }
  });

  await prisma.inventoryBalance.upsert({
    where: { articleId },
    create: {
      articleId,
      locationId,
      quantity: delta,
      lastMovementAt: movement.createdAt
    },
    update: {
      quantity: (current?.quantity ?? 0) + delta,
      lastMovementAt: movement.createdAt
    }
  });
}

async function main() {
  await prisma.adminSession.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.inventoryBalance.deleteMany();
  await prisma.kioskDevice.deleteMany();
  await prisma.articleImage.deleteMany();
  await prisma.userLocation.deleteMany();
  await prisma.locationSettings.deleteMany();
  await prisma.article.deleteMany();
  await prisma.location.deleteMany();
  await prisma.user.deleteMany();

  const masterPasswordHash = await bcrypt.hash("Stockly123!", 10);
  const adminPasswordHash = await bcrypt.hash("Admin123!", 10);
  const berlinPinHash = await bcrypt.hash("1234", 10);
  const hamburgPinHash = await bcrypt.hash("5678", 10);

  const masterAdmin = await prisma.user.create({
    data: {
      email: "master@stockly.local",
      name: "Master Admin",
      passwordHash: masterPasswordHash,
      role: Role.MASTER_ADMIN
    }
  });

  const admin = await prisma.user.create({
    data: {
      email: "lager@stockly.local",
      name: "Lagerleitung",
      passwordHash: adminPasswordHash,
      role: Role.ADMIN
    }
  });

  const berlin = await prisma.location.create({
    data: {
      name: "Berlin Lager",
      code: "BER",
      description: "Hauptlager fuer Netzwerktechnik und Servicebedarf.",
      kioskPinHash: berlinPinHash,
      settings: {
        create: {
          agingWarningDays: 21,
          allowNegativeStock: false,
          lowStockBuffer: 0
        }
      }
    }
  });

  const hamburg = await prisma.location.create({
    data: {
      name: "Hamburg Lager",
      code: "HAM",
      description: "Sekundaerstandort fuer Reserve- und Projektmaterial.",
      kioskPinHash: hamburgPinHash,
      settings: {
        create: {
          agingWarningDays: 30,
          allowNegativeStock: false,
          lowStockBuffer: 0
        }
      }
    }
  });

  await prisma.userLocation.createMany({
    data: [
      { userId: admin.id, locationId: berlin.id },
      { userId: masterAdmin.id, locationId: berlin.id },
      { userId: masterAdmin.id, locationId: hamburg.id }
    ]
  });

  const articleData = await Promise.all(
    [
      {
        locationId: berlin.id,
        name: "SFP Modul 10G",
        barcode: "1001001001",
        description: "Single-Mode SFP+ Modul fuer Core-Switche.",
        manufacturerNumber: "SFP-10G-SM",
        supplierNumber: "SUP-001",
        category: "Optik",
        sortOrder: 1,
        minimumStock: 5
      },
      {
        locationId: berlin.id,
        name: "Patchkabel LC-LC 5m",
        barcode: "1001001002",
        description: "Glasfaser-Patchkabel fuer Feld- und Rackeinsatz.",
        manufacturerNumber: "LC5M",
        supplierNumber: "SUP-010",
        category: "Kabel",
        sortOrder: 1,
        minimumStock: 12
      },
      {
        locationId: berlin.id,
        name: "Switch 24 Port",
        barcode: "1001001003",
        description: "Managed Access-Switch fuer Projekte und Reservegeraete.",
        manufacturerNumber: "SW24-MG",
        supplierNumber: "SUP-122",
        category: "Hardware",
        sortOrder: 1,
        minimumStock: 2
      },
      {
        locationId: berlin.id,
        name: "Kabelfuehrung 1HE",
        barcode: "1001001004",
        description: "Rack-Zubehoer ohne Buchungsbewegung fuer Testdaten.",
        manufacturerNumber: "RACK-1HE",
        supplierNumber: "SUP-051",
        category: "Rack",
        sortOrder: 1,
        minimumStock: 1
      },
      {
        locationId: hamburg.id,
        name: "Medienkonverter 1G",
        barcode: "2002002001",
        description: "Reservegeraet fuer Standort Hamburg.",
        manufacturerNumber: "MC-1G",
        supplierNumber: "SUP-221",
        category: "Hardware",
        sortOrder: 1,
        minimumStock: 3
      }
    ].map((item) => prisma.article.create({ data: item }))
  );

  const [sfp, patchCable, switch24, cableGuide, mediaConverter] = articleData;

  await applyMovement(
    sfp.id,
    berlin.id,
    {
      type: MovementType.GOODS_RECEIPT,
      quantity: 18,
      sourceType: SourceType.ADMIN,
      note: "Erstbestand aus Lieferung",
      createdAt: new Date("2026-02-01T09:00:00Z")
    },
    masterAdmin.id
  );
  await applyMovement(sfp.id, berlin.id, {
    type: MovementType.TAKE,
    quantity: 8,
    sourceType: SourceType.KIOSK,
    usageReason: "crossconnect",
    createdAt: new Date("2026-03-12T10:15:00Z")
  });
  await applyMovement(sfp.id, berlin.id, {
    type: MovementType.RETURN,
    quantity: 1,
    sourceType: SourceType.KIOSK,
    note: "Unbenutztes Modul zurueck",
    createdAt: new Date("2026-03-13T12:45:00Z")
  });

  await applyMovement(
    patchCable.id,
    berlin.id,
    {
      type: MovementType.GOODS_RECEIPT,
      quantity: 40,
      sourceType: SourceType.ADMIN,
      note: "Wareneingang Februar",
      createdAt: new Date("2026-02-05T08:30:00Z")
    },
    admin.id
  );
  await applyMovement(patchCable.id, berlin.id, {
    type: MovementType.TAKE,
    quantity: 12,
    sourceType: SourceType.KIOSK,
    usageReason: "project",
    createdAt: new Date("2026-03-02T06:20:00Z")
  });
  await applyMovement(patchCable.id, berlin.id, {
    type: MovementType.TAKE,
    quantity: 9,
    sourceType: SourceType.KIOSK,
    usageReason: "smarthand",
    createdAt: new Date("2026-03-21T15:00:00Z")
  });
  await applyMovement(
    patchCable.id,
    berlin.id,
    {
      type: MovementType.CORRECTION,
      quantity: -2,
      sourceType: SourceType.ADMIN,
      note: "Beschaedigte Kabel ausgesondert",
      createdAt: new Date("2026-03-23T09:10:00Z")
    },
    admin.id
  );

  await applyMovement(
    switch24.id,
    berlin.id,
    {
      type: MovementType.GOODS_RECEIPT,
      quantity: 4,
      sourceType: SourceType.ADMIN,
      note: "Projektbestand",
      createdAt: new Date("2025-11-15T10:00:00Z")
    },
    masterAdmin.id
  );
  await applyMovement(switch24.id, berlin.id, {
    type: MovementType.TAKE,
    quantity: 2,
    sourceType: SourceType.KIOSK,
    usageReason: "custom order",
    createdAt: new Date("2025-12-05T11:00:00Z")
  });

  await prisma.inventoryBalance.create({
    data: {
      articleId: cableGuide.id,
      locationId: berlin.id,
      quantity: 0
    }
  });

  await applyMovement(
    mediaConverter.id,
    hamburg.id,
    {
      type: MovementType.GOODS_RECEIPT,
      quantity: 9,
      sourceType: SourceType.ADMIN,
      note: "Reserve fuer Hamburg",
      createdAt: new Date("2026-01-10T10:30:00Z")
    },
    masterAdmin.id
  );
  await applyMovement(mediaConverter.id, hamburg.id, {
    type: MovementType.TAKE,
    quantity: 2,
    sourceType: SourceType.KIOSK,
    usageReason: "project",
    createdAt: new Date("2026-03-07T08:00:00Z")
  });

  console.log("Seed erfolgreich erstellt.");
  console.log("Master Admin: master@stockly.local / Stockly123!");
  console.log("Admin: lager@stockly.local / Admin123!");
  console.log("Kiosk PIN Berlin: 1234");
  console.log("Kiosk PIN Hamburg: 5678");
}

main()
  .catch((error) => {
    console.error("Seed fehlgeschlagen:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
