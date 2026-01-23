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
import { Card } from "@/components/ui/card";
import { Upload, X, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useTeaTypes } from "@/hooks/use-tea-types";

const productSchema = z.object({
  name: z.string().min(2, "Название должно содержать минимум 2 символа"),
  category: z.enum(["tea", "teaware"], {
    errorMap: () => ({ message: "Выберите категорию: чай или посуда" })
  }),
  pricingUnit: z.enum(["gram", "piece"], {
    errorMap: () => ({ message: "Выберите единицу измерения: граммы или штуки" })
  }),
  pricePerGram: z.number().min(0, "Цена должна быть положительной"),
  description: z.string().min(10, "Описание должно содержать минимум 10 символов"),
  images: z.array(z.string().min(1)).min(1, "Добавьте хотя бы одно изображение"),
  teaType: z.string().min(1, "Выберите тип"),
  effects: z.array(z.string()).min(0, "Укажите эффекты или оставьте пустым"),
  availableQuantities: z.array(z.string().regex(/^\d+$/, "Количество должно быть числом")).min(1, "Добавьте хотя бы одно доступное количество"),
  defaultQuantity: z.string().regex(/^\d+$/, "Количество должно быть числом").optional().nullable(),
  fixedQuantityOnly: z.boolean(),
  fixedQuantity: z.number().int().positive().optional().nullable(),
  outOfStock: z.boolean(),
}).refine((data) => {
  if (data.fixedQuantityOnly && !data.fixedQuantity) {
    return false;
  }
  return true;
}, {
  message: "Укажите фиксированное количество, если включен режим фиксированного количества",
  path: ["fixedQuantity"],
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
  const [isUploading, setIsUploading] = useState(false);
  const [showNewTypeInput, setShowNewTypeInput] = useState(false);
  const [newType, setNewType] = useState("");
  const [showNewEffectInput, setShowNewEffectInput] = useState(false);
  const [newEffect, setNewEffect] = useState("");
  const [showNewQuantityInput, setShowNewQuantityInput] = useState(false);
  const [newQuantity, setNewQuantity] = useState("");

  // Fetch available tea types from API
  const { data: teaTypes } = useTeaTypes();
  
  // Fetch available effects from API
  const { data: tags, isLoading: isLoadingTags } = useQuery<{ types: string[], effects: string[] }>({
    queryKey: ['/api/tags'],
  });

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: defaultValues?.name || "",
      category: (defaultValues as any)?.category || "tea",
      pricingUnit: (defaultValues as any)?.pricingUnit || "gram",
      pricePerGram: defaultValues?.pricePerGram || 0,
      description: defaultValues?.description || "",
      images: defaultValues?.images || [],
      teaType: defaultValues?.teaType || "",
      effects: defaultValues?.effects || [],
      availableQuantities: defaultValues?.availableQuantities || ["25", "50", "100"],
      defaultQuantity: (defaultValues as any)?.defaultQuantity || null,
      fixedQuantityOnly: defaultValues?.fixedQuantityOnly || false,
      fixedQuantity: defaultValues?.fixedQuantity || null,
      outOfStock: (defaultValues as any)?.outOfStock || false,
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('images', file);
      });

      const adminPassword = sessionStorage.getItem('adminPassword');
      const headers: HeadersInit = {};
      if (adminPassword) {
        headers['X-Admin-Password'] = adminPassword;
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();
      const currentImages = form.getValues('images');
      const newImages = [...currentImages, ...data.urls];
      form.setValue('images', newImages);
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Ошибка загрузки файлов';
      alert(`Ошибка загрузки файлов: ${errorMessage}`);
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (index: number) => {
    const currentImages = form.getValues('images');
    form.setValue('images', currentImages.filter((_, i) => i !== index));
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
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Категория</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} data-testid="select-category">
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите категорию" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="tea">Чай</SelectItem>
                  <SelectItem value="teaware">Чайная посуда</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="pricingUnit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Единица измерения</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} data-testid="select-pricing-unit">
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите единицу" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="gram">Граммы (чай россыпью)</SelectItem>
                  <SelectItem value="piece">Штуки (блин, посуда)</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                {field.value === "piece" 
                  ? "Товар будет продаваться поштучно" 
                  : "Товар будет продаваться по весу в граммах"}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="pricePerGram"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {form.watch("pricingUnit") === "piece" ? "Цена за штуку (₽)" : "Цена за грамм (₽/г)"}
              </FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  step="0.1"
                  placeholder="12"
                  {...field}
                  value={field.value || ''}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    field.onChange(isNaN(value) ? 0 : value);
                  }}
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
              
              {field.value ? (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-base px-3 py-1" data-testid="badge-selected-tea-type">
                    {field.value}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => field.onChange("")}
                    data-testid="button-clear-tea-type"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : showNewTypeInput ? (
                <div className="flex gap-2">
                  <Input
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    placeholder="Введите новый тип чая"
                    data-testid="input-new-tea-type"
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      if (newType.trim()) {
                        field.onChange(newType.trim());
                        setNewType("");
                        setShowNewTypeInput(false);
                      }
                    }}
                    data-testid="button-save-new-type"
                  >
                    Сохранить
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowNewTypeInput(false);
                      setNewType("");
                    }}
                    data-testid="button-cancel-new-type"
                  >
                    Отмена
                  </Button>
                </div>
              ) : (
                <>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-tea-type">
                        <SelectValue placeholder="Выберите тип чая" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {teaTypes?.map((type) => (
                        <SelectItem key={type.id} value={type.name} data-testid={`option-tea-type-${type.name}`}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewTypeInput(true)}
                    className="mt-2"
                    data-testid="button-add-new-type"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Создать новый тип
                  </Button>
                </>
              )}
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
              
              {/* Selected effects badges */}
              {form.watch("effects").length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {form.watch("effects").map((effect) => (
                    <Badge 
                      key={effect} 
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => toggleEffect(effect)}
                      data-testid={`badge-effect-${effect}`}
                    >
                      {effect}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                </div>
              )}

              {/* Available effects checkboxes */}
              <div className="grid grid-cols-2 gap-3 mt-2">
                {tags?.effects.map((effect) => (
                  <div key={effect} className="flex items-center space-x-2">
                    <Checkbox
                      id={effect}
                      checked={form.watch("effects").includes(effect)}
                      onCheckedChange={() => toggleEffect(effect)}
                      data-testid={`checkbox-effect-${effect}`}
                    />
                    <Label
                      htmlFor={effect}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {effect}
                    </Label>
                  </div>
                ))}
              </div>

              {/* Add new effect */}
              {showNewEffectInput ? (
                <div className="flex gap-2 mt-2">
                  <Input
                    value={newEffect}
                    onChange={(e) => setNewEffect(e.target.value)}
                    placeholder="Введите новый эффект"
                    data-testid="input-new-effect"
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      if (newEffect.trim()) {
                        const currentEffects = form.getValues("effects");
                        form.setValue("effects", [...currentEffects, newEffect.trim()]);
                        setNewEffect("");
                        setShowNewEffectInput(false);
                      }
                    }}
                    data-testid="button-save-new-effect"
                  >
                    Добавить
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowNewEffectInput(false);
                      setNewEffect("");
                    }}
                    data-testid="button-cancel-new-effect"
                  >
                    Отмена
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewEffectInput(true)}
                  className="mt-2"
                  data-testid="button-add-new-effect"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Создать новый эффект
                </Button>
              )}

              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="availableQuantities"
          render={() => (
            <FormItem>
              <FormLabel>Доступные количества (г)</FormLabel>
              <FormDescription className="text-sm text-muted-foreground">
                Укажите доступные количества для заказа (например: 25, 50, 100, 357 грамм)
              </FormDescription>
              
              {/* Selected quantities badges */}
              {form.watch("availableQuantities").length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {form.watch("availableQuantities").sort((a, b) => parseInt(a) - parseInt(b)).map((qty) => (
                    <Badge 
                      key={qty} 
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => {
                        const current = form.getValues("availableQuantities");
                        form.setValue("availableQuantities", current.filter(q => q !== qty));
                      }}
                      data-testid={`badge-quantity-${qty}`}
                    >
                      {qty}г
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                </div>
              )}

              {/* Add new quantity */}
              {showNewQuantityInput ? (
                <div className="flex gap-2 mt-2">
                  <Input
                    type="number"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    placeholder="Введите количество в граммах (например: 357)"
                    data-testid="input-new-quantity"
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      if (newQuantity.trim() && /^\d+$/.test(newQuantity)) {
                        const currentQuantities = form.getValues("availableQuantities");
                        if (!currentQuantities.includes(newQuantity.trim())) {
                          form.setValue("availableQuantities", [...currentQuantities, newQuantity.trim()]);
                        }
                        setNewQuantity("");
                        setShowNewQuantityInput(false);
                      }
                    }}
                    data-testid="button-save-new-quantity"
                  >
                    Добавить
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowNewQuantityInput(false);
                      setNewQuantity("");
                    }}
                    data-testid="button-cancel-new-quantity"
                  >
                    Отмена
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewQuantityInput(true)}
                  className="mt-2"
                  data-testid="button-add-new-quantity"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Добавить количество
                </Button>
              )}

              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="defaultQuantity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Количество по умолчанию</FormLabel>
              <FormDescription className="text-sm text-muted-foreground">
                Выберите количество, которое будет выбрано по умолчанию при открытии карточки товара
              </FormDescription>
              <Select
                onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                value={field.value || "none"}
              >
                <FormControl>
                  <SelectTrigger data-testid="select-default-quantity">
                    <SelectValue placeholder="Первое из списка" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">Первое из списка</SelectItem>
                  {form.watch("availableQuantities").sort((a, b) => parseInt(a) - parseInt(b)).map((qty) => (
                    <SelectItem key={qty} value={qty}>
                      {qty}{form.watch("pricingUnit") === "piece" ? " шт" : "г"}
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
          name="fixedQuantityOnly"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="checkbox-fixed-quantity-only"
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>
                  Продаётся только в фиксированном количестве
                </FormLabel>
                <FormDescription>
                  Включите эту опцию, если чай продаётся только в одном количестве (например, только блинами по 357г)
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        {form.watch("fixedQuantityOnly") && (
          <FormField
            control={form.control}
            name="fixedQuantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Фиксированное количество (г)</FormLabel>
                <FormDescription className="text-sm text-muted-foreground">
                  Укажите количество в граммах (например, 357 для блина пуэра)
                </FormDescription>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="357"
                    {...field}
                    value={field.value || ""}
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : null)}
                    data-testid="input-fixed-quantity"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="outOfStock"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="checkbox-out-of-stock"
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>
                  Товар закончился
                </FormLabel>
                <FormDescription>
                  Включите эту опцию, если товара нет в наличии. Он будет виден на сайте, но его нельзя будет добавить в корзину.
                </FormDescription>
              </div>
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
          name="images"
          render={() => (
            <FormItem>
              <FormLabel>Изображения</FormLabel>
              <FormDescription className="text-sm text-muted-foreground">
                Загрузите одно или несколько изображений товара
              </FormDescription>
              
              {/* Image previews */}
              {form.watch('images').length > 0 && (
                <div className="grid grid-cols-3 gap-4 mt-2">
                  {form.watch('images').map((url, index) => (
                    <Card key={index} className="relative p-2">
                      <img 
                        src={url} 
                        alt={`Preview ${index + 1}`} 
                        className="w-full h-32 object-cover rounded-md"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                        onClick={() => removeImage(index)}
                        data-testid={`button-remove-image-${index}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Card>
                  ))}
                </div>
              )}

              {/* Upload button */}
              <div className="mt-2">
                <label htmlFor="image-upload">
                  <div className="border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover-elevate transition-all">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {isUploading ? "Загрузка..." : "Нажмите для загрузки изображений"}
                    </p>
                  </div>
                  <Input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    data-testid="input-product-images"
                  />
                </label>
              </div>
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
            disabled={isSubmitting || isUploading}
            data-testid="button-cancel-product"
          >
            Отмена
          </Button>
          <Button
            type="submit"
            className="flex-1 bg-primary text-primary-foreground border border-primary-border hover-elevate active-elevate-2"
            disabled={isSubmitting || isUploading || form.watch('images').length === 0}
            data-testid="button-save-product"
          >
            {isSubmitting ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
