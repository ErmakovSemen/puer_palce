import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { 
  Tv, 
  Plus, 
  Trash2, 
  Image as ImageIcon, 
  Trophy, 
  Clock, 
  GripVertical,
  ExternalLink,
  Pencil,
} from "lucide-react";
import type { TvSlide } from "@shared/schema";

interface AdminTVDisplayProps {
  adminFetch: (url: string, options?: RequestInit) => Promise<any>;
}

export default function AdminTVDisplay({ adminFetch }: AdminTVDisplayProps) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<TvSlide | null>(null);
  const [formData, setFormData] = useState({
    type: "image" as "image" | "leaderboard",
    title: "",
    durationSeconds: 60,
    isActive: true,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: slides = [], isLoading } = useQuery<TvSlide[]>({
    queryKey: ["/api/admin/tv-slides"],
    queryFn: () => adminFetch("/api/admin/tv-slides"),
  });

  const createSlideMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch("/api/admin/tv-slides", {
        method: "POST",
        headers: {
          "X-Admin-Password": sessionStorage.getItem("adminPassword") || "",
        },
        body: data,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Ошибка" }));
        throw new Error(error.error || "Ошибка создания слайда");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tv-slides"] });
      toast({ title: "Слайд добавлен" });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const updateSlideMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FormData }) => {
      const response = await fetch(`/api/admin/tv-slides/${id}`, {
        method: "PATCH",
        headers: {
          "X-Admin-Password": sessionStorage.getItem("adminPassword") || "",
        },
        body: data,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Ошибка" }));
        throw new Error(error.error || "Ошибка обновления слайда");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tv-slides"] });
      toast({ title: "Слайд обновлён" });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const deleteSlideMutation = useMutation({
    mutationFn: async (id: number) => {
      return adminFetch(`/api/admin/tv-slides/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tv-slides"] });
      toast({ title: "Слайд удалён" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const openDialog = (slide?: TvSlide) => {
    if (slide) {
      setEditingSlide(slide);
      setFormData({
        type: slide.type as "image" | "leaderboard",
        title: slide.title || "",
        durationSeconds: slide.durationSeconds,
        isActive: slide.isActive,
      });
    } else {
      setEditingSlide(null);
      setFormData({
        type: "image",
        title: "",
        durationSeconds: 60,
        isActive: true,
      });
    }
    setSelectedFile(null);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingSlide(null);
    setSelectedFile(null);
  };

  const handleSubmit = () => {
    const data = new FormData();
    data.append("type", formData.type);
    data.append("title", formData.title);
    data.append("durationSeconds", formData.durationSeconds.toString());
    data.append("isActive", formData.isActive.toString());
    data.append("orderIndex", slides.length.toString());

    if (selectedFile) {
      data.append("image", selectedFile);
    }

    if (editingSlide) {
      updateSlideMutation.mutate({ id: editingSlide.id, data });
    } else {
      createSlideMutation.mutate(data);
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds} сек`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins} мин ${secs} сек` : `${mins} мин`;
  };

  const openTVDisplay = () => {
    window.open("/tv-display", "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Tv className="w-5 h-5" />
            ТВ-дисплей
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Настройте слайд-шоу для телевизора (3840x2160)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openTVDisplay} data-testid="button-open-tv-display">
            <ExternalLink className="w-4 h-4 mr-2" />
            Открыть дисплей
          </Button>
          <Button onClick={() => openDialog()} data-testid="button-add-slide">
            <Plus className="w-4 h-4 mr-2" />
            Добавить слайд
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : slides.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Tv className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">Нет слайдов</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Добавьте лидерборд или загрузите изображения для показа на ТВ
            </p>
            <div className="flex justify-center gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setFormData({ ...formData, type: "leaderboard", title: "Лидерборд" });
                  setIsDialogOpen(true);
                }}
              >
                <Trophy className="w-4 h-4 mr-2" />
                Добавить лидерборд
              </Button>
              <Button onClick={() => openDialog()}>
                <ImageIcon className="w-4 h-4 mr-2" />
                Загрузить изображение
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {slides.map((slide, index) => (
            <Card key={slide.id} className={!slide.isActive ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 text-muted-foreground cursor-grab">
                    <GripVertical className="w-5 h-5" />
                  </div>
                  
                  <div className="flex-shrink-0 w-24 h-14 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                    {slide.type === "leaderboard" ? (
                      <Trophy className="w-6 h-6 text-amber-500" />
                    ) : slide.imageUrl ? (
                      <img 
                        src={slide.imageUrl} 
                        alt={slide.title || "Слайд"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {slide.title || (slide.type === "leaderboard" ? "Лидерборд" : `Слайд ${index + 1}`)}
                      </span>
                      <Badge variant={slide.type === "leaderboard" ? "default" : "secondary"}>
                        {slide.type === "leaderboard" ? "Лидерборд" : "Изображение"}
                      </Badge>
                      {!slide.isActive && (
                        <Badge variant="outline">Скрыт</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{formatDuration(slide.durationSeconds)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => openDialog(slide)}
                      data-testid={`button-edit-slide-${slide.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => deleteSlideMutation.mutate(slide.id)}
                      data-testid={`button-delete-slide-${slide.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSlide ? "Редактировать слайд" : "Добавить слайд"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Тип слайда</Label>
              <Select 
                value={formData.type} 
                onValueChange={(v) => setFormData({ ...formData, type: v as "image" | "leaderboard" })}
              >
                <SelectTrigger data-testid="select-slide-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="leaderboard">Лидерборд</SelectItem>
                  <SelectItem value="image">Изображение</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Название (опционально)</Label>
              <Input 
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Например: Акция недели"
                data-testid="input-slide-title"
              />
            </div>

            {formData.type === "image" && (
              <div className="space-y-2">
                <Label>Изображение (3840x2160 рекомендуется)</Label>
                <Input 
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  data-testid="input-slide-image"
                />
                {editingSlide?.imageUrl && !selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    Текущее изображение сохранится, если не выбрать новое
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Длительность показа (секунды)</Label>
              <Input 
                type="number"
                min={5}
                max={3600}
                value={formData.durationSeconds}
                onChange={(e) => setFormData({ ...formData, durationSeconds: parseInt(e.target.value) || 60 })}
                data-testid="input-slide-duration"
              />
              <p className="text-sm text-muted-foreground">
                От 5 секунд до 1 часа ({formatDuration(formData.durationSeconds)})
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Switch 
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                data-testid="switch-slide-active"
              />
              <Label>Активен</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Отмена
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={formData.type === "image" && !editingSlide?.imageUrl && !selectedFile}
              data-testid="button-save-slide"
            >
              {editingSlide ? "Сохранить" : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
