import { useRef, useState } from "react";
import { ShoppingCart, User, LogOut, MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface HeaderProps {
  cartItemCount: number;
  onCartClick: () => void;
  onLogoClick?: () => void;
  isAdmin?: boolean;
}

export default function Header({ cartItemCount, onCartClick, onLogoClick, isAdmin = false }: HeaderProps) {
  const { user, logoutMutation } = useAuth();
  const cartFormRef = useRef<HTMLFormElement>(null);
  const contactFormRef = useRef<HTMLFormElement>(null);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  
  const handleLogoClick = () => {
    if (onLogoClick) {
      onLogoClick();
    }
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <iframe
        name="goal-cart-iframe"
        style={{ display: 'none', width: 0, height: 0, border: 'none' }}
        aria-hidden="true"
      />
      <iframe
        name="goal-contact-iframe"
        style={{ display: 'none', width: 0, height: 0, border: 'none' }}
        aria-hidden="true"
      />
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Left side: Logo + Contact button on mobile */}
          <div className="flex items-center gap-2 sm:gap-0">
            <Link href="/" onClick={handleLogoClick} data-testid="link-home">
              <h1 className="font-serif text-2xl md:text-3xl font-bold text-foreground cursor-pointer hover-elevate px-2 sm:px-4 py-2 rounded-md transition-all">
                Пуэр Паб
              </h1>
            </Link>
            
            {/* Contact button - mobile only (left side) */}
            {!isAdmin && (
              <Button
                onClick={() => setIsContactDialogOpen(true)}
                className="btn-gradient btn-gradient-sparkle px-3 py-1.5 text-sm flex items-center gap-1.5 no-default-hover-elevate no-default-active-elevate sm:hidden"
                data-testid="button-contact-mobile"
              >
                <Sparkles className="w-4 h-4" />
                <span>Написать</span>
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-3 md:gap-4">
            
            {/* Contact button - desktop only (right side next to Войти) */}
            {!isAdmin && (
              <Button
                onClick={() => setIsContactDialogOpen(true)}
                className="btn-gradient btn-gradient-sparkle px-5 py-2 text-base hidden sm:flex items-center gap-2 no-default-hover-elevate no-default-active-elevate"
                data-testid="button-contact"
              >
                <Sparkles className="w-5 h-5" />
                <span>Связаться с нами</span>
              </Button>
            )}
            
            {/* User auth button */}
            {!isAdmin && (
              <>
                {user ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-16 w-16 relative"
                        data-testid="button-user-menu"
                      >
                        <User className="w-12 h-12" />
                        {!user.firstOrderDiscountUsed && (
                          <Badge 
                            className="absolute -top-1 -right-2 h-6 min-w-[1.5rem] px-1.5 flex items-center justify-center bg-amber-500 text-white border-2 border-amber-600 text-xs font-bold z-10"
                            data-testid="badge-discount-available"
                          >
                            20%
                          </Badge>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>
                        {user.name || user.email}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/profile" data-testid="link-profile">
                          Личный кабинет
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={handleLogout}
                        data-testid="button-logout"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Выйти
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button
                    variant="ghost"
                    className="relative"
                    asChild
                    data-testid="button-login"
                  >
                    <Link href="/auth">
                      Войти
                      <Badge 
                        className="absolute -top-1 -right-1 h-6 min-w-[1.5rem] px-1.5 flex items-center justify-center bg-amber-500 text-white border-2 border-amber-600 text-xs font-bold z-10"
                        data-testid="badge-login-discount"
                      >
                        20%
                      </Badge>
                    </Link>
                  </Button>
                )}
              </>
            )}
            
            {/* Cart button wrapped in visible form for Yandex Metrica goal tracking */}
            {!isAdmin && (
              <form
                ref={cartFormRef}
                id="goal-cart-form"
                action="/goal/cart"
                method="POST"
                target="goal-cart-iframe"
                onSubmit={(e) => {
                  // Allow form to submit, then trigger cart action
                  setTimeout(() => onCartClick(), 0);
                }}
                data-testid="form-cart-goal"
              >
                <input type="hidden" name="goal" value="cart" />
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  className="relative h-16 w-16"
                  data-testid="button-cart"
                >
                  <ShoppingCart className="w-12 h-12" />
                  {cartItemCount > 0 && (
                    <Badge 
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-primary text-primary-foreground border border-primary-border z-20"
                      data-testid="badge-cart-count"
                    >
                      {cartItemCount}
                    </Badge>
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Contact Dialog */}
      <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif text-center">
              Связаться с нами
            </DialogTitle>
            <DialogDescription className="text-center pt-4 text-base">
              Задайте вопрос и получите бесплатную консультацию по подбору чая
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-4">
            <form
              ref={contactFormRef}
              id="goal-contact-form"
              action="/goal/contact"
              method="POST"
              target="goal-contact-iframe"
              onSubmit={() => {
                setTimeout(() => {
                  window.open("https://t.me/PuerPabbot?start=ask", "_blank", "noopener,noreferrer");
                  setIsContactDialogOpen(false);
                }, 0);
              }}
              data-testid="form-contact-goal"
            >
              <input type="hidden" name="goal" value="contact" />
              <Button
                type="submit"
                className="w-full"
                data-testid="button-telegram-contact"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                Написать в Telegram
              </Button>
            </form>
            <Button
              variant="outline"
              onClick={() => setIsContactDialogOpen(false)}
              data-testid="button-close-contact-dialog"
            >
              Закрыть
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
