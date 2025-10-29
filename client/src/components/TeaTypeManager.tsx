import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TeaType, InsertTeaType } from "@shared/schema";

interface TeaTypeManagerProps {
  adminPassword: string;
}

export default function TeaTypeManager({ adminPassword }: TeaTypeManagerProps) {
  const [editingType, setEditingType] = useState<TeaType | null>(null);
  const [formData, setFormData] = useState<InsertTeaType>({
    name: "",
    backgroundColor: "#8B4513",
    textColor: "#FFFFFF",
  });
  const { toast } = useToast();

  const adminFetch = async (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);
    headers.set("X-Admin-Password", adminPassword);
    
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(error.error || "Request failed");
    }

    return response.json();
  };

  const { data: teaTypes = [], isLoading } = useQuery<TeaType[]>({
    queryKey: ["/api/tea-types"],
    queryFn: () => adminFetch("/api/tea-types"),
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertTeaType) => {
      const response = await fetch("/api/tea-types", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": adminPassword,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create tea type");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tea-types"] });
      resetForm();
      toast({ title: "Успех", description: "Тип чая создан" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: InsertTeaType }) => {
      const response = await fetch(`/api/tea-types/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": adminPassword,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update tea type");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tea-types"] });
      resetForm();
      toast({ title: "Успех", description: "Тип чая обновлён" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/tea-types/${id}`, {
        method: "DELETE",
        headers: { "X-Admin-Password": adminPassword },
      });
      if (!response.ok) {
        throw new Error("Failed to delete");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tea-types"] });
      toast({ title: "Успех", description: "Тип чая удалён" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", backgroundColor: "#8B4513", textColor: "#FFFFFF" });
    setEditingType(null);
  };

  const handleEdit = (type: TeaType) => {
    setEditingType(type);
    setFormData({
      name: type.name,
      backgroundColor: type.backgroundColor,
      textColor: type.textColor,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({ title: "Ошибка", description: "Введите название типа чая", variant: "destructive" });
      return;
    }

    if (editingType) {
      updateMutation.mutate({ id: editingType.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return <Card className="p-8 text-center">Загрузка...</Card>;
  }

  return (
    <div className="space-y-6">
      {/* Form */}
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold font-serif">
              {editingType ? "Редактировать тип чая" : "Добавить новый тип чая"}
            </h3>
            {editingType && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetForm}
                data-testid="button-cancel-edit"
              >
                <X className="h-4 w-4 mr-1" />
                Отмена
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Название типа</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Шу Пуэр"
                data-testid="input-tea-type-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="backgroundColor">Цвет фона</Label>
              <div className="flex gap-2">
                <Input
                  id="backgroundColor"
                  type="color"
                  value={formData.backgroundColor}
                  onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
                  className="w-16 h-10 cursor-pointer"
                  data-testid="input-bg-color"
                />
                <Input
                  type="text"
                  value={formData.backgroundColor}
                  onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
                  placeholder="#8B4513"
                  className="font-mono"
                  data-testid="input-bg-color-text"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="textColor">Цвет текста</Label>
              <div className="flex gap-2">
                <Input
                  id="textColor"
                  type="color"
                  value={formData.textColor}
                  onChange={(e) => setFormData({ ...formData, textColor: e.target.value })}
                  className="w-16 h-10 cursor-pointer"
                  data-testid="input-text-color"
                />
                <Input
                  type="text"
                  value={formData.textColor}
                  onChange={(e) => setFormData({ ...formData, textColor: e.target.value })}
                  placeholder="#FFFFFF"
                  className="font-mono"
                  data-testid="input-text-color-text"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label>Предпросмотр</Label>
              <Badge
                className="mt-2"
                style={{
                  backgroundColor: formData.backgroundColor,
                  color: formData.textColor,
                  border: "3px double black",
                }}
                data-testid="badge-preview"
              >
                {formData.name || "Пример"}
              </Badge>
            </div>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit-tea-type"
            >
              {editingType ? "Сохранить" : "Добавить"}
            </Button>
          </div>
        </form>
      </Card>

      {/* List */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold font-serif mb-4">Все типы чая ({teaTypes.length})</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teaTypes.map((type) => (
            <Card key={type.id} className="p-4 hover-elevate" data-testid={`card-tea-type-${type.id}`}>
              <div className="flex items-center justify-between mb-3">
                <Badge
                  style={{
                    backgroundColor: type.backgroundColor,
                    color: type.textColor,
                    border: "3px double black",
                  }}
                  data-testid={`badge-tea-type-${type.id}`}
                >
                  {type.name}
                </Badge>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(type)}
                    data-testid={`button-edit-${type.id}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm(`Удалить тип "${type.name}"?`)) {
                        deleteMutation.mutate(type.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-${type.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <div className="flex items-center gap-2">
                  <span>Фон:</span>
                  <code className="text-xs px-1 bg-muted rounded">{type.backgroundColor}</code>
                </div>
                <div className="flex items-center gap-2">
                  <span>Текст:</span>
                  <code className="text-xs px-1 bg-muted rounded">{type.textColor}</code>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {teaTypes.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Нет типов чая. Добавьте первый тип выше.
          </div>
        )}
      </Card>
    </div>
  );
}
