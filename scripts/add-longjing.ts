import { readFileSync } from "fs";
import { randomUUID } from "crypto";
import { ObjectStorageService } from "../server/objectStorage";
import { db } from "../server/db";
import { products } from "../shared/schema";

async function addLongjingProduct() {
  try {
    const imageBuffer = readFileSync("attached_assets/longjing.jpg");
    const filename = `${randomUUID()}.jpg`;
    
    const objectStorageService = new ObjectStorageService();
    console.log("Uploading image to Object Storage...");
    const imageUrl = await objectStorageService.uploadPublicObject(imageBuffer, filename);
    console.log(`Image uploaded: ${imageUrl}`);

    const productData = {
      name: "Лун Цзин (Dragon Well)",
      pricePerGram: 25,
      description: "«Лун Цзин» («Колодец дракона») — знаменитый китайский зелёный чай, который считается символом чайной культуры Китая. Собирают его ранней весной, когда листья ещё молодые и нежные, что придаёт напитку характерный мягкий и маслянистый вкус. Аромат включает ноты жареных семечек, запечённого каштана и пекана, а также оттенки свежескошенной травы и морского бриза. Чай богат полифенолами, которые поддерживают иммунитет и способствуют замедлению процессов старения. Регулярное употребление Лун Цзина положительно влияет на обмен веществ и общее состояние организма.",
      images: [imageUrl],
      teaType: "Зеленый чай",
      teaTypeColor: "#2E7D32",
      effects: ["Бодрит"]
    };

    console.log("Adding product to database...");
    const result = await db.insert(products).values(productData).returning();
    console.log("Product added successfully:", result[0]);
    
    process.exit(0);
  } catch (error) {
    console.error("Error adding product:", error);
    process.exit(1);
  }
}

addLongjingProduct();
