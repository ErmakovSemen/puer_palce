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

const productSchema = z.object({
  name: z.string().min(2, "Название должно содержать минимум 2 символа"),
  pricePerGram: z.number().min(0, "Цена должна быть положительной"),
  description: z.string().min(10, "Описание должно содержать минимум 10 символов"),
  images: z.array(z.string().min(1)).min(1, "Добавьте хотя бы одно изображение"),
  teaType: z.string().min(1, "Выберите тип чая"),
  teaTypeColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Введите корректный hex-цвет (например, #8B4513)"),
  effects: z.array(z.string()).min(1, "Выберите хотя бы один эффект"),
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

  // Fetch available tags from API
  const { data: tags, isLoading: isLoadingTags } = useQuery<{ types: string[], effects: string[] }>({
    queryKey: ['/api/tags'],
  });

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: defaultValues?.name || "",
      pricePerGram: defaultValues?.pricePerGram || 0,
      description: defaultValues?.description || "",
      images: defaultValues?.images || [],
      teaType: defaultValues?.teaType || "",
      teaTypeColor: defaultValues?.teaTypeColor || "#8B4513",
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
          name="pricePerGram"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Цена за грамм (₽/г)</FormLabel>
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
                      {tags?.types.map((type) => (
                        <SelectItem key={type} value={type} data-testid={`option-tea-type-${type}`}>
                          {type}
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
          name="teaTypeColor"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Цвет тега типа чая</FormLabel>
              <div className="flex items-center gap-3">
                <FormControl>
                  <Input 
                    type="color"
                    {...field}
                    className="w-20 h-10 cursor-pointer"
                    data-testid="input-tea-type-color"
                  />
                </FormControl>
                <FormControl>
                  <Input 
                    type="text"
                    {...field}
                    placeholder="#8B4513"
                    className="font-mono"
                    data-testid="input-tea-type-color-text"
                  />
                </FormControl>
                <div 
                  className="w-10 h-10 rounded border border-border"
                  style={{ backgroundColor: field.value }}
                  data-testid="preview-tea-type-color"
                />
              </div>
              <FormDescription className="text-sm text-muted-foreground">
                Цвет будет виден при наведении мыши на карточку товара
              </FormDescription>
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
