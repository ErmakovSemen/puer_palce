import CartDrawer from '../CartDrawer';
import { useState } from 'react';
import teaImage from "@assets/stock_images/puer_tea_leaves_clos_59389e23.jpg";

export default function CartDrawerExample() {
  const [items, setItems] = useState([
    { id: 1, name: "Шу Пуэр Императорский", category: "tea", price: 1200, originalPrice: 1200, quantity: 100, image: teaImage },
    { id: 2, name: "Шен Пуэр Дикий", category: "tea", price: 1500, originalPrice: 1500, quantity: 50, image: teaImage }
  ]);

  return (
    <CartDrawer
      isOpen={true}
      onClose={() => console.log('Close cart')}
      items={items}
      onUpdateQuantity={(id, quantity) => {
        setItems(items.map(item => 
          item.id === id ? { ...item, quantity } : item
        ).filter(item => item.quantity > 0));
      }}
      onRemoveItem={(id) => {
        setItems(items.filter(item => item.id !== id));
      }}
      onCheckout={() => console.log('Checkout')}
    />
  );
}
