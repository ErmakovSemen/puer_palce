import { apiRequest, queryClient } from "@/lib/queryClient";

/**
 * Migrate guest cart from localStorage to user's database cart
 * Should be called after successful login or registration
 */
export async function migrateGuestCart(): Promise<void> {
  try {
    // Read guest cart from localStorage
    const guestCartJson = localStorage.getItem('guestCart');
    if (!guestCartJson) {
      return; // No guest cart to migrate
    }

    const guestCart = JSON.parse(guestCartJson);
    if (!Array.isArray(guestCart) || guestCart.length === 0) {
      localStorage.removeItem('guestCart');
      return; // Empty cart
    }

    // Track which items were successfully migrated
    const successfulIds = new Set<number>();

    // Migrate each item to user's cart
    await Promise.all(
      guestCart.map(async (item: any) => {
        // Validate item structure
        if (!item || 
            typeof item.id !== 'number' || 
            typeof item.quantity !== 'number' ||
            item.id <= 0 ||
            item.quantity <= 0 ||
            !Number.isInteger(item.id) ||
            !Number.isInteger(item.quantity)) {
          console.error('Invalid cart item, skipping migration:', item);
          return;
        }

        try {
          await apiRequest("POST", "/api/cart", {
            productId: item.id,
            quantity: item.quantity,
          });
          // Track successful migration
          successfulIds.add(item.id);
        } catch (error) {
          console.error(`Failed to migrate cart item ${item.id}:`, error);
          // Don't track - failed items will remain in cart
        }
      })
    );

    // Read current cart state to handle concurrent updates
    const currentCartJson = localStorage.getItem('guestCart');
    
    if (successfulIds.size === guestCart.length && !currentCartJson) {
      // All items migrated successfully and no concurrent updates - clear localStorage
      localStorage.removeItem('guestCart');
    } else {
      // Some items failed or there were concurrent updates
      // Keep only items that weren't successfully migrated
      let cartToSave: any[] = [];
      
      if (currentCartJson) {
        try {
          const currentCart = JSON.parse(currentCartJson);
          if (Array.isArray(currentCart)) {
            // Filter out successfully migrated items, keep everything else
            // This preserves:
            // - Failed migrations (still in cart with updated data)
            // - New items added during migration
            // - Updated quantities for existing items
            cartToSave = currentCart.filter(item => 
              item && typeof item.id === 'number' && !successfulIds.has(item.id)
            );
          }
        } catch (error) {
          console.error('Failed to parse current guest cart:', error);
          // On parse error, keep failed items from original snapshot
          cartToSave = guestCart.filter(item => !successfulIds.has(item.id));
        }
      } else {
        // Current cart was cleared, keep failed items from original snapshot
        cartToSave = guestCart.filter(item => !successfulIds.has(item.id));
      }
      
      if (cartToSave.length > 0) {
        localStorage.setItem('guestCart', JSON.stringify(cartToSave));
      } else {
        localStorage.removeItem('guestCart');
      }
    }

    // Invalidate cart cache to fetch updated cart from server
    await queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
  } catch (error) {
    console.error('Failed to migrate guest cart:', error);
    // Don't throw - we don't want to block login if cart migration fails
  }
}
