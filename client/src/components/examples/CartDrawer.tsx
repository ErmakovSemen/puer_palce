import CartDrawer from '../CartDrawer';
import { useState } from 'react';
import teaImage from "@assets/stock_images/puer_tea_leaves_clos_59389e23.jpg";

export default function CartDrawerExample() {
  const [items, setItems] = useState([
    { id: 1, name: "Шу Пуэр Императорский", price: 1200, quantity: 2, image: teaImage },
    { id: 2, name: "Шен Пуэр Дикий", price: 1500, quantity: 1, image: teaImage }
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
