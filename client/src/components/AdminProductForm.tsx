import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const productSchema = z.object({
  name: z.string().min(2, "Название должно содержать минимум 2 символа"),
  price: z.number().min(0, "Цена должна быть положительной"),
  description: z.string().min(10, "Описание должно содержать минимум 10 символов"),
  imageUrl: z.string().url("Введите корректный URL изображения"),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface AdminProductFormProps {
  onSubmit: (data: ProductFormValues) => void;
  onCancel: () => void;
  defaultValues?: Partial<ProductFormValues>;
  isSubmitting?: boolean;
}

export default function AdminProductForm({ 
  onSubmit, 
  onCancel, 
  defaultValues,
  isSubmitting = false 
}: AdminProductFormProps) {
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: defaultValues?.name || "",
      price: defaultValues?.price || 0,
      description: defaultValues?.description || "",
      imageUrl: defaultValues?.imageUrl || "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Название</FormLabel>
              <FormControl>
                <Input placeholder="Шу Пуэр Императорский" {...field} data-testid="input-product-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Цена (₽)</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  placeholder="1200"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  data-testid="input-product-price"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Описание</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Выдержанный темный пуэр с глубоким землистым вкусом..."
                  {...field}
                  data-testid="input-product-description"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL изображения</FormLabel>
              <FormControl>
                <Input 
                  placeholder="https://example.com/image.jpg"
                  {...field}
                  data-testid="input-product-image"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1"
            disabled={isSubmitting}
            data-testid="button-cancel-product"
          >
            Отмена
          </Button>
          <Button
            type="submit"
            className="flex-1 bg-primary text-primary-foreground border border-primary-border hover-elevate active-elevate-2"
            disabled={isSubmitting}
            data-testid="button-save-product"
          >
            {isSubmitting ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
