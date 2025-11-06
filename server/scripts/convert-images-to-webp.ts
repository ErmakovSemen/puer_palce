import sharp from 'sharp';
import { ObjectStorageService, objectStorageClient } from '../objectStorage';
import { db } from '../db';
import { products } from '../../shared/schema';
import { sql } from 'drizzle-orm';

async function convertImagesToWebP() {
  console.log('[Convert] Starting image conversion to WebP...');
  
  const objectStorageService = new ObjectStorageService();
  const searchPaths = objectStorageService.getPublicObjectSearchPaths();
  
  if (searchPaths.length === 0) {
    throw new Error("No public object search paths configured");
  }

  // Get all products with images
  const allProducts = await db.select().from(products);
  console.log(`[Convert] Found ${allProducts.length} products`);

  let totalConverted = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const product of allProducts) {
    if (!product.images || product.images.length === 0) {
      console.log(`[Convert] Product ${product.id} (${product.name}) has no images, skipping`);
      continue;
    }

    const newImages: string[] = [];
    
    for (const imageUrl of product.images) {
      try {
        // Strip query strings and hash fragments first
        const cleanUrl = imageUrl.split('?')[0].split('#')[0];
        
        // Skip if already WebP
        if (cleanUrl.endsWith('.webp')) {
          console.log(`[Convert] Image ${imageUrl} is already WebP, skipping`);
          newImages.push(imageUrl);
          totalSkipped++;
          continue;
        }

        // Extract filename from URL - handle both relative and full URLs
        let filename: string;
        if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
          // Full URL: extract the path after the last occurrence of '/public/'
          const publicIndex = cleanUrl.lastIndexOf('/public/');
          if (publicIndex === -1) {
            console.warn(`[Convert] Cannot extract filename from URL: ${imageUrl}, skipping`);
            newImages.push(imageUrl);
            totalFailed++;
            continue;
          }
          filename = cleanUrl.substring(publicIndex + '/public/'.length);
        } else {
          // Relative URL: just remove '/public/' prefix
          filename = cleanUrl.replace('/public/', '');
        }
        
        console.log(`[Convert] Extracted filename: ${filename} from URL: ${imageUrl}`);
        
        // Search for the file in object storage
        const file = await objectStorageService.searchPublicObject(filename);
        
        if (!file) {
          console.warn(`[Convert] File not found: ${filename}, keeping original URL`);
          newImages.push(imageUrl);
          totalFailed++;
          continue;
        }

        // Download the original image
        const [buffer] = await file.download();
        console.log(`[Convert] Downloaded ${filename}, size: ${buffer.length} bytes`);

        // Convert to WebP
        const webpFilename = filename.replace(/\.(jpg|jpeg|png|gif)$/i, '.webp');
        const webpBuffer = await sharp(buffer)
          .resize(1920, 1920, { 
            fit: 'inside', 
            withoutEnlargement: true 
          })
          .webp({ quality: 80 })
          .toBuffer();

        console.log(`[Convert] Converted to WebP: ${webpFilename}, new size: ${webpBuffer.length} bytes (${Math.round((1 - webpBuffer.length / buffer.length) * 100)}% reduction)`);

        // Upload the WebP version
        const webpUrl = await objectStorageService.uploadPublicObject(webpBuffer, webpFilename);
        console.log(`[Convert] Uploaded WebP version: ${webpUrl}`);

        newImages.push(webpUrl);
        totalConverted++;

        // Optional: Delete the original file to save space
        // await file.delete();
        // console.log(`[Convert] Deleted original file: ${filename}`);

      } catch (error) {
        console.error(`[Convert] Error processing ${imageUrl}:`, error);
        newImages.push(imageUrl); // Keep original URL on error
        totalFailed++;
      }
    }

    // Update product with new image URLs
    if (newImages.length > 0) {
      await db.update(products)
        .set({ images: newImages })
        .where(sql`${products.id} = ${product.id}`);
      console.log(`[Convert] Updated product ${product.id} (${product.name}) with ${newImages.length} images`);
    }
  }

  console.log('[Convert] Conversion complete!');
  console.log(`[Convert] Statistics:`);
  console.log(`  - Converted: ${totalConverted}`);
  console.log(`  - Skipped (already WebP): ${totalSkipped}`);
  console.log(`  - Failed: ${totalFailed}`);
}

// Run the conversion
convertImagesToWebP()
  .then(() => {
    console.log('[Convert] Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Convert] Fatal error:', error);
    process.exit(1);
  });
