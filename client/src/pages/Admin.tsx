import { useState } from "react";
import Header from "@/components/Header";
import AdminProductForm from "@/components/AdminProductForm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// todo: remove mock functionality
import teaImage1 from "@assets/stock_images/puer_tea_leaves_clos_59389e23.jpg";

interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
  imageUrl: string;
  teaType: string;
  effects: string[];
}

const mockInitialProducts: Product[] = [
  { 
    id: 1, 
    name: "Шу Пуэр Императорский", 
    price: 12, 
    description: "Выдержанный темный пуэр с глубоким землистым вкусом и нотками сухофруктов", 
    imageUrl: teaImage1,
    teaType: "Шу Пуэр",
    effects: ["Бодрит", "Согревает"]
  },
  { 
    id: 2, 
    name: "Шен Пуэр Дикий", 
    price: 15, 
    description: "Свежий зеленый пуэр с цветочными нотами и легкой сладостью", 
    imageUrl: teaImage1,
    teaType: "Шен Пуэр",
    effects: ["Концентрирует", "Освежает"]
  },
];

export default function Admin() {
  const [products, setProducts] = useState<Product[]>(mockInitialProducts);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const { toast } = useToast();

  const handleAddProduct = () => {
    setEditingProduct(null);
    setIsFormOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  const handleDeleteProduct = (id: number) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    toast({
      title: "Товар удален",
      description: "Товар успешно удален из каталога",
    });
  };

  const handleFormSubmit = (data: any) => {
    if (editingProduct) {
      setProducts(prev =>
        prev.map(p => (p.id === editingProduct.id ? { ...p, ...data } : p))
      );
      toast({
        title: "Товар обновлен",
        description: "Изменения сохранены",
      });
    } else {
      const newProduct = {
        id: Math.max(0, ...products.map(p => p.id)) + 1,
        ...data,
      };
      setProducts(prev => [...prev, newProduct]);
      toast({
        title: "Товар добавлен",
        description: "Новый товар добавлен в каталог",
      });
    }
    setIsFormOpen(false);
    setEditingProduct(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        cartItemCount={0}
        onCartClick={() => {}}
        isAdmin={true}
      />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-serif text-4xl font-bold" data-testid="text-admin-title">
            Управление товарами
          </h1>
          <Button
            onClick={handleAddProduct}
            className="bg-primary text-primary-foreground border border-primary-border hover-elevate active-elevate-2"
            data-testid="button-add-product"
          >
            <Plus className="w-4 h-4 mr-2" />
            Добавить товар
          </Button>
        </div>

        <div className="space-y-4">
          {products.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground" data-testid="text-no-products">
                Нет товаров. Добавьте первый товар.
              </p>
            </Card>
          ) : (
            products.map((product) => (
              <Card key={product.id} className="p-6" data-testid={`admin-product-${product.id}`}>
                <div className="flex gap-6">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-32 h-32 object-cover rounded-md"
                    data-testid={`img-admin-product-${product.id}`}
                  />
                  <div className="flex-1 space-y-3">
                    <div>
                      <h3 className="font-serif text-2xl font-semibold mb-2" data-testid={`text-admin-product-name-${product.id}`}>
                        {product.name}
                      </h3>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <Badge 
                          variant="default" 
                          className="bg-primary text-primary-foreground border border-primary-border"
                          data-testid={`badge-admin-tea-type-${product.id}`}
                        >
                          {product.teaType}
                        </Badge>
                        {product.effects.map((effect) => (
                          <Badge 
                            key={effect} 
                            variant="outline"
                            data-testid={`badge-admin-effect-${product.id}-${effect}`}
                          >
                            {effect}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <p className="text-muted-foreground" data-testid={`text-admin-product-description-${product.id}`}>
                      {product.description}
                    </p>
                    <p className="text-xl font-semibold text-primary" data-testid={`text-admin-product-price-${product.id}`}>
                      {product.price} ₽/г
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleEditProduct(product)}
                      data-testid={`button-edit-product-${product.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDeleteProduct(product.id)}
                      data-testid={`button-delete-product-${product.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">
              {editingProduct ? "Редактировать товар" : "Добавить товар"}
            </DialogTitle>
            <DialogDescription>
              {editingProduct
                ? "Внесите изменения в информацию о товаре"
                : "Заполните информацию о новом товаре"}
            </DialogDescription>
          </DialogHeader>
          <AdminProductForm
            onSubmit={handleFormSubmit}
            onCancel={() => {
              setIsFormOpen(false);
              setEditingProduct(null);
            }}
            defaultValues={editingProduct || undefined}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
