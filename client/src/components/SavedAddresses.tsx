import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MapPin, Plus, Trash2, Star } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSavedAddressSchema, type SavedAddress } from "@shared/schema";
import { z } from "zod";

const addressFormSchema = insertSavedAddressSchema.omit({ userId: true });
type AddressFormData = z.infer<typeof addressFormSchema>;

export function SavedAddresses() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);

  const form = useForm<AddressFormData>({
    resolver: zodResolver(addressFormSchema),
    defaultValues: {
      address: "",
      isDefault: false,
    },
  });

  const { data: addresses = [], isLoading } = useQuery<SavedAddress[]>({
    queryKey: ['/api/addresses'],
  });

  const createAddressMutation = useMutation({
    mutationFn: async (data: AddressFormData) => {
      return await apiRequest('POST', '/api/addresses', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/addresses'] });
      setShowAddDialog(false);
      form.reset();
      toast({
        title: "Адрес сохранён",
        description: "Ваш адрес успешно добавлен",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось сохранить адрес",
        variant: "destructive",
      });
    },
  });

  const deleteAddressMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/addresses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/addresses'] });
      toast({
        title: "Адрес удалён",
        description: "Адрес успешно удалён",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить адрес",
        variant: "destructive",
      });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('PATCH', `/api/addresses/${id}/default`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/addresses'] });
      toast({
        title: "Адрес по умолчанию",
        description: "Адрес установлен как основной",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось установить адрес",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = form.handleSubmit((data) => {
    createAddressMutation.mutate(data);
  });

  if (isLoading) {
    return (
      <div className="py-8">
        <p className="text-center text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Add Address Button */}
        <Button
          variant="default"
          size="default"
          onClick={() => setShowAddDialog(true)}
          disabled={addresses.length >= 10}
          className="w-full"
          data-testid="button-add-address"
        >
          <Plus className="w-4 h-4 mr-2" />
          Добавить адрес
        </Button>

        {addresses.length >= 10 && (
          <p className="text-sm text-muted-foreground text-center" data-testid="text-address-limit">
            Достигнут лимит сохранённых адресов (максимум 10)
          </p>
        )}

        {/* Addresses List */}
        {addresses.length === 0 ? (
          <div className="py-8">
            <p className="text-center text-muted-foreground" data-testid="text-no-addresses">
              У вас пока нет сохранённых адресов
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {addresses.map((address) => (
              <Card key={address.id} data-testid={`card-address-${address.id}`}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        {address.isDefault && (
                          <Badge variant="default" className="bg-primary text-primary-foreground border-[3px] border-double border-black" data-testid={`badge-default-${address.id}`}>
                            Основной
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm" data-testid={`text-address-${address.id}`}>
                        {address.address}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!address.isDefault && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setDefaultMutation.mutate(address.id)}
                          disabled={setDefaultMutation.isPending}
                          data-testid={`button-set-default-${address.id}`}
                        >
                          <Star className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => deleteAddressMutation.mutate(address.id)}
                        disabled={deleteAddressMutation.isPending}
                        data-testid={`button-delete-${address.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Address Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md" data-testid="dialog-add-address">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Добавить адрес
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Адрес доставки</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Введите полный адрес доставки"
                        data-testid="input-address"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddDialog(false);
                    form.reset();
                  }}
                  data-testid="button-cancel-add"
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  disabled={createAddressMutation.isPending}
                  className="flex-1"
                  data-testid="button-save-address"
                >
                  {createAddressMutation.isPending ? "Сохранение..." : "Сохранить"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
