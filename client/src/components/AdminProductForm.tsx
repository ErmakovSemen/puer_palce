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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const productSchema = z.object({
  name: z.string().min(2, "Название должно содержать минимум 2 символа"),
  price: z.number().min(0, "Цена должна быть положительной"),
  description: z.string().min(10, "Описание должно содержать минимум 10 символов"),
  imageUrl: z.string().url("Введите корректный URL изображения"),
  teaType: z.string().min(1, "Выберите тип чая"),
  effects: z.array(z.string()).min(1, "Выберите хотя бы один эффект"),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface AdminProductFormProps {
  onSubmit: (data: ProductFormValues) => void;
  onCancel: () => void;
  defaultValues?: Partial<ProductFormValues>;
  isSubmitting?: boolean;
}

const teaTypes = [
  { value: "Шу Пуэр", label: "Шу Пуэр" },
  { value: "Шен Пуэр", label: "Шен Пуэр" },
  { value: "Габа", label: "Габа" },
  { value: "Красный", label: "Красный" },
  { value: "Выдержанный", label: "Выдержанный" },
];

const availableEffects = [
  { id: "Бодрит", label: "Бодрит" },
  { id: "Успокаивает", label: "Успокаивает" },
  { id: "Концентрирует", label: "Концентрирует" },
  { id: "Согревает", label: "Согревает" },
  { id: "Расслабляет", label: "Расслабляет" },
  { id: "Тонизирует", label: "Тонизирует" },
  { id: "Освежает", label: "Освежает" },
  { id: "Медитативный", label: "Медитативный" },
];

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
      teaType: defaultValues?.teaType || "",
      effects: defaultValues?.effects || [],
    },
  });

  const toggleEffect = (effectId: string) => {
    const currentEffects = form.getValues("effects");
    if (currentEffects.includes(effectId)) {
      form.setValue("effects", currentEffects.filter(e => e !== effectId));
    } else {
      form.setValue("effects", [...currentEffects, effectId]);
    }
  };

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
              <FormLabel>Цена за грамм (₽/г)</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  step="0.1"
                  placeholder="12"
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
          name="teaType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Тип чая</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-tea-type">
                    <SelectValue placeholder="Выберите тип чая" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {teaTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value} data-testid={`option-tea-type-${type.value}`}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="effects"
          render={() => (
            <FormItem>
              <FormLabel>Эффекты</FormLabel>
              <FormDescription className="text-sm text-muted-foreground">
                Выберите один или несколько эффектов
              </FormDescription>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {availableEffects.map((effect) => (
                  <div key={effect.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={effect.id}
                      checked={form.watch("effects").includes(effect.id)}
                      onCheckedChange={() => toggleEffect(effect.id)}
                      data-testid={`checkbox-effect-${effect.id}`}
                    />
                    <Label
                      htmlFor={effect.id}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {effect.label}
                    </Label>
                  </div>
                ))}
              </div>
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
