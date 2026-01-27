import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Video, Image, ExternalLink, Upload } from "lucide-react";
import type { Media, Product } from "@shared/schema";

interface AdminMediaProps {
  adminPassword: string;
}

export default function AdminMedia({ adminPassword }: AdminMediaProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  const [formData, setFormData] = useState({
    productId: "",
    type: "video" as "video" | "image",
    title: "",
    description: "",
    sourceUrl: "",
    featured: true,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);

  const { data: mediaItems = [], isLoading: mediaLoading } = useQuery<Media[]>({
    queryKey: ["/api/media"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const createMediaMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch("/api/admin/media", {
        method: "POST",
        headers: {
          "X-Admin-Password": adminPassword,
        },
        body: data,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload media");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      toast({ title: "Добавлено в истории" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const deleteMediaMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/admin/media/${id}`, {
        method: "DELETE",
        headers: { "X-Admin-Password": adminPassword },
      });
      if (!response.ok) {
        throw new Error("Failed to delete media");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      toast({ title: "Удалено из историй" });
    },
    onError: () => {
      toast({ title: "Ошибка удаления", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      productId: "",
      type: "video",
      title: "",
      description: "",
      sourceUrl: "",
      featured: true,
    });
    setSelectedFile(null);
    setThumbnailFile(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.productId) {
      toast({ title: "Выберите товар", variant: "destructive" });
      return;
    }

    if (!selectedFile && !formData.sourceUrl) {
      toast({ title: "Загрузите файл или укажите URL", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    
    const data = new FormData();
    data.append("productId", formData.productId);
    data.append("type", formData.type);
    data.append("featured", String(formData.featured));
    
    if (formData.title) data.append("title", formData.title);
    if (formData.description) data.append("description", formData.description);
    if (formData.sourceUrl) data.append("sourceUrl", formData.sourceUrl);
    if (selectedFile) data.append("file", selectedFile);
    if (thumbnailFile) data.append("thumbnail", thumbnailFile);

    try {
      await createMediaMutation.mutateAsync(data);
    } finally {
      setIsUploading(false);
    }
  };

  const getProductName = (productId: number) => {
    const product = products.find(p => p.id === productId);
    return product?.name || `Товар #${productId}`;
  };

  if (mediaLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl sm:text-2xl font-semibold">Истории</h2>
        <Button onClick={() => setShowForm(!showForm)} data-testid="button-add-media">
          <Plus className="w-4 h-4 mr-2" />
          Добавить
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Загрузить медиа</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Товар *</Label>
                  <Select
                    value={formData.productId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, productId: value }))}
                  >
                    <SelectTrigger data-testid="select-product">
                      <SelectValue placeholder="Выберите товар" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(product => (
                        <SelectItem key={product.id} value={String(product.id)}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Тип *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: "video" | "image") => setFormData(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger data-testid="select-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="video">Видео</SelectItem>
                      <SelectItem value="image">Изображение</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Файл ({formData.type === "video" ? "MP4" : "JPG/PNG"})</Label>
                <Input
                  type="file"
                  accept={formData.type === "video" ? "video/mp4,video/*" : "image/*"}
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  data-testid="input-file"
                />
                <p className="text-xs text-muted-foreground">
                  Или укажите URL ниже
                </p>
              </div>

              <div className="space-y-2">
                <Label>URL источника (альтернатива файлу)</Label>
                <Input
                  type="url"
                  placeholder="https://..."
                  value={formData.sourceUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, sourceUrl: e.target.value }))}
                  data-testid="input-source-url"
                />
              </div>

              {formData.type === "video" && (
                <div className="space-y-2">
                  <Label>Превью (опционально)</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
                    data-testid="input-thumbnail"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Название (опционально)</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Название медиа"
                    data-testid="input-title"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Описание (опционально)</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Заваривание, Дегустация..."
                    data-testid="input-description"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.featured}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, featured: checked }))}
                  data-testid="switch-featured"
                />
                <Label>Показывать на главной</Label>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={isUploading} data-testid="button-submit-media">
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Загрузка...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Загрузить
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm} data-testid="button-cancel-media">
                  Отмена
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mediaItems.map((item) => (
          <Card key={item.id} className="overflow-hidden">
            <div className="aspect-[9/16] bg-muted relative">
              {item.type === "video" ? (
                item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt={item.title || "Video thumbnail"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Video className="w-12 h-12 text-muted-foreground" />
                  </div>
                )
              ) : (
                <img
                  src={item.source}
                  alt={item.title || "Image"}
                  className="w-full h-full object-cover"
                />
              )}
              <div className="absolute top-2 left-2">
                {item.type === "video" ? (
                  <div className="bg-black/70 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                    <Video className="w-3 h-3" />
                    Видео
                  </div>
                ) : (
                  <div className="bg-black/70 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                    <Image className="w-3 h-3" />
                    Фото
                  </div>
                )}
              </div>
              {item.featured && (
                <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs">
                  На главной
                </div>
              )}
            </div>
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{item.title || getProductName(item.productId)}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {getProductName(item.productId)}
                  </p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  {item.sourceType === "url" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      asChild
                    >
                      <a href={item.source} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteMediaMutation.mutate(item.id)}
                    disabled={deleteMediaMutation.isPending}
                    data-testid={`button-delete-media-${item.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {mediaItems.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Истории пока не добавлены</p>
            <p className="text-sm">Нажмите "Добавить" чтобы загрузить видео или фото</p>
          </div>
        )}
      </div>
    </div>
  );
}
